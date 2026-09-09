import { Claim } from '../../modules/claims/claim.model.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import {
  evaluateClaimData,
  loadClaimData,
} from '../../domain/claims/claimPolicyContext.js';
import type {
  ClaimData,
  StoredEvidence,
} from '../../domain/claims/claimPolicyContext.js';
import { resolveApprovers } from '../../domain/claims/approvers.js';
import { reviewStatuses } from '../../domain/claims/transitions.js';
import { WorkflowError, requireWorkflow } from '../../domain/claims/errors.js';
import type {
  Actor,
  WorkflowContext,
  ClaimStatus,
} from '../../domain/claims/types.js';

const financeStates: ClaimStatus[] = [
  'FINANCE_REVIEW',
  'PAYMENT_SCHEDULED',
  'PAID',
];
export function canViewClaim(actor: Actor, context: WorkflowContext): boolean {
  if (actor.employeeId === context.claim.employeeId) return true;
  if (
    actor.organizationalRole === 'FINANCE' &&
    financeStates.includes(context.claim.status)
  )
    return true;
  try {
    const route = resolveApprovers(
      context.claimant,
      context.claim.reviewRoute.map((item) => item.level),
      context.hierarchy,
    );
    return route.some(
      (item) =>
        reviewStatuses[item.level] === context.claim.status &&
        item.employeeId === actor.employeeId &&
        actor.organizationalRole === item.level &&
        context.claim.reviewRoute.some(
          (stored) =>
            stored.level === item.level &&
            stored.employeeId === item.employeeId,
        ),
    );
  } catch (error) {
    if (error instanceof WorkflowError) return false;
    throw error;
  }
}
async function visible(data: ClaimData, actor: Actor): Promise<boolean> {
  if (data.claim.employee.toString() === actor.employeeId) return true;
  if (
    actor.organizationalRole === 'FINANCE' &&
    financeStates.includes(data.claim.status)
  )
    return true;
  if (
    !data.claim.reviewRoute?.some(
      (item) =>
        item.employeeId.toString() === actor.employeeId &&
        reviewStatuses[item.level] === data.claim.status,
    )
  )
    return false;
  return canViewClaim(actor, await evaluateClaimData(data));
}
export async function getVisibleClaim(claimId: string, actor: Actor) {
  const data = await loadClaimData(claimId);
  requireWorkflow(
    await visible(data, actor),
    'ACTION_NOT_ALLOWED',
    'This claim is not visible to the actor.',
  );
  return data;
}
export async function getClaimEvaluation(claimId: string, actor: Actor) {
  return (await evaluateClaimData(await getVisibleClaim(claimId, actor)))
    .policy;
}
export async function listVisibleClaims(
  actor: Actor,
  queue?: 'approvals' | 'finance',
): Promise<ClaimData[]> {
  if (queue === 'finance')
    requireWorkflow(
      actor.organizationalRole === 'FINANCE',
      'FINANCE_ROLE_REQUIRED',
      'Finance queue requires Finance.',
    );
  const conditions =
    queue === 'finance'
      ? [{ status: { $in: financeStates } }]
      : [
          ...(queue ? [] : [{ employee: actor.employeeId }]),
          {
            status: { $in: Object.values(reviewStatuses) },
            'reviewRoute.employeeId': actor.employeeId,
          },
          ...(!queue && actor.organizationalRole === 'FINANCE'
            ? [{ status: { $in: financeStates } }]
            : []),
        ];
  const claims = await Claim.find({ $or: conditions })
    .sort({ updatedAt: -1, _id: 1 })
    .lean()
    .exec();
  const result: ClaimData[] = [];
  for (const claim of claims) {
    const data = await loadClaimData(claim._id.toString());
    if (
      queue === 'approvals' &&
      (data.claim.employee.toString() === actor.employeeId ||
        !data.claim.reviewRoute?.some(
          (item) =>
            item.employeeId.toString() === actor.employeeId &&
            reviewStatuses[item.level] === data.claim.status,
        ))
    )
      continue;
    if (queue === 'finance' && !financeStates.includes(data.claim.status))
      continue;
    if (await visible(data, actor)) result.push(data);
  }
  return result;
}
export async function listDemoUsers() {
  return Employee.find({ sourceDataset: 'assignment-pack-v1' })
    .sort({ employeeCode: 1 })
    .lean()
    .exec();
}
export async function getVisibleTravel(travelId: string, actor: Actor) {
  const travel = await TravelRequest.findById(travelId).lean().exec();
  requireWorkflow(
    travel,
    'TRAVEL_REQUEST_NOT_FOUND',
    'Travel request was not found.',
  );
  if (travel.employee.toString() !== actor.employeeId) {
    const claims = await listVisibleClaims(actor);
    requireWorkflow(
      claims.some((item) => item.claim.travelRequest.toString() === travelId),
      'ACTION_NOT_ALLOWED',
      'This travel request is not visible to the actor.',
    );
  }
  const employee = await Employee.findById(travel.employee).lean().exec();
  requireWorkflow(
    employee,
    'CLAIM_STATE_CONFLICT',
    'Travel employee reference is missing.',
  );
  return { travel, employee };
}
export async function listVisibleTravels(actor: Actor) {
  const claims = await listVisibleClaims(actor);
  const travels = await TravelRequest.find({
    $or: [
      { employee: actor.employeeId },
      { _id: { $in: claims.map((item) => item.claim.travelRequest) } },
    ],
  })
    .sort({ startDate: -1, _id: 1 })
    .lean()
    .exec();
  return Promise.all(
    travels.map((item) => getVisibleTravel(item._id.toString(), actor)),
  );
}
export async function listEvidence(
  travelId: string,
  actor: Actor,
  filters: {
    kind?: StoredEvidence['kind'];
    classification?: StoredEvidence['classification'];
  },
) {
  await getVisibleTravel(travelId, actor);
  return Evidence.find({ travelRequest: travelId, ...filters })
    .sort({ sourceFilename: 1, _id: 1 })
    .lean()
    .exec();
}
export async function getEvidence(evidenceId: string, actor: Actor) {
  const evidence = await Evidence.findById(evidenceId).lean().exec();
  requireWorkflow(evidence, 'EVIDENCE_NOT_FOUND', 'Evidence was not found.');
  await getVisibleTravel(evidence.travelRequest.toString(), actor);
  return evidence;
}
export async function listExpenses(travelId: string, actor: Actor) {
  await getVisibleTravel(travelId, actor);
  return Expense.find({ travelRequest: travelId })
    .sort({ expenseDate: 1, seedKey: 1, _id: 1 })
    .lean()
    .exec();
}
