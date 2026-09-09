import { createHash } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import type { InferSchemaType, Types } from 'mongoose';
import { Claim } from '../../modules/claims/claim.model.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { evaluateClaimPolicy } from '../policy/evaluateClaim.js';
import type { ApprovalLevel, PolicyInput } from '../policy/types.js';
import { requireWorkflow } from './errors.js';
import { employeeActor } from './identity.js';
import { businessLevels } from './types.js';
import type { Actor, WorkflowClaim, WorkflowContext } from './types.js';

type StoredClaim = InferSchemaType<typeof Claim.schema> & {
  _id: Types.ObjectId;
};
type StoredTravel = InferSchemaType<typeof TravelRequest.schema>;
type StoredExpense = InferSchemaType<typeof Expense.schema> & {
  _id: Types.ObjectId;
};
type StoredEvidence = InferSchemaType<typeof Evidence.schema> & {
  _id: Types.ObjectId;
};

export function workflowClaim(claim: StoredClaim): WorkflowClaim {
  const finance = claim.finance;
  return {
    claimId: claim._id.toString(),
    employeeId: claim.employee.toString(),
    status: claim.status,
    reviewCycle: claim.reviewCycle ?? 0,
    workflowVersion: claim.workflowVersion ?? 0,
    reviewInputHash: claim.reviewInputHash ?? null,
    reviewRoute: (claim.reviewRoute ?? []).map((item) => ({
      level: item.level,
      employeeId: item.employeeId.toString(),
    })),
    approvals: claim.approvals.map((item) => ({
      level: item.level,
      approver: item.approver.toString(),
      decision: item.decision,
      decidedAt: item.decidedAt,
      reviewCycle: item.reviewCycle,
      ...(item.remarks ? { remarks: item.remarks } : {}),
    })),
    workflowHistory: (claim.workflowHistory ?? []).map((item) => ({
      action: item.action,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      actor: item.actor.toString(),
      actorRole: item.actorRole,
      occurredAt: item.occurredAt,
      reviewCycle: item.reviewCycle,
      ...(item.remarks ? { remarks: item.remarks } : {}),
    })),
    finance: finance
      ? {
          verifiedBy: finance.verifiedBy.toString(),
          verifiedAt: finance.verifiedAt,
          reviewCycle: finance.reviewCycle,
          ...(finance.paymentScheduledFor
            ? { paymentScheduledFor: finance.paymentScheduledFor }
            : {}),
          ...(finance.paymentScheduledBy
            ? { paymentScheduledBy: finance.paymentScheduledBy.toString() }
            : {}),
          ...(finance.paidAt ? { paidAt: finance.paidAt } : {}),
          ...(finance.paymentReference
            ? { paymentReference: finance.paymentReference }
            : {}),
        }
      : null,
  };
}
export function assembleClaimPolicyInput(
  claim: StoredClaim,
  travel: StoredTravel,
  expenses: readonly StoredExpense[],
  evidence: readonly StoredEvidence[],
): PolicyInput {
  requireWorkflow(
    travel.employee.toString() === claim.employee.toString(),
    'CLAIM_STATE_CONFLICT',
    'Claim and travel claimant differ.',
  );
  const ids = claim.expenses.map((id) => id.toString());
  requireWorkflow(
    new Set(ids).size === ids.length &&
      expenses.length === ids.length &&
      expenses.every(
        (item) =>
          ids.includes(item._id.toString()) &&
          item.travelRequest.toString() === claim.travelRequest.toString(),
      ),
    'CLAIM_STATE_CONFLICT',
    'Claim expense references are incomplete or inconsistent.',
  );
  requireWorkflow(
    evidence.every(
      (item) =>
        item.travelRequest.toString() === claim.travelRequest.toString(),
    ),
    'CLAIM_STATE_CONFLICT',
    'Evidence belongs to another travel request.',
  );
  const preTravelApprovals = travel.preTravelApprovals.map((item) => {
    const level = businessLevels.find((level) => level === item.role);
    requireWorkflow(
      level,
      'CLAIM_STATE_CONFLICT',
      'Historical approval has an unsupported business level.',
    );
    return {
      level: level as ApprovalLevel,
      decision: item.decision,
      approvedAt: item.approvedAt.toISOString(),
      evidenceKey: item.evidence.toString(),
    };
  });
  return {
    claimantKey: claim.employee.toString(),
    travel: {
      travelRequestId: travel.travelRequestId ?? null,
      destination: travel.destination,
      startDate: travel.startDate,
      endDate: travel.endDate,
      travelType: travel.travelType,
      estimatedSpendMinor: travel.estimatedSpendMinor,
      advanceMinor: travel.advanceDisbursedMinor,
      preTravelApprovals,
    },
    evidence: [...evidence]
      .sort((a, b) => a._id.toString().localeCompare(b._id.toString()))
      .map((item) => ({
        key: item._id.toString(),
        classification: item.classification,
        relationships: item.relationships.map((relation) => ({
          type: relation.type,
          evidenceKey: relation.evidence.toString(),
        })),
      })),
    expenses: [...expenses]
      .sort((a, b) => a._id.toString().localeCompare(b._id.toString()))
      .map((item) => ({
        key: item._id.toString(),
        employeeKey: item.employee.toString(),
        category: item.category,
        componentType: item.componentType,
        amountMinor: item.amountMinor,
        currency: item.currency,
        paidBy: item.paidBy,
        expenseDate: item.expenseDate ?? null,
        merchant: item.merchant,
        sourceReviewState: item.sourceReviewState,
        evidenceKeys: item.sourceEvidence.map((id) => id.toString()).sort(),
        ...(item.occurredAt
          ? { occurredAt: item.occurredAt.toISOString() }
          : {}),
        ...(item.details?.invoiceNumber
          ? { billReference: item.details.invoiceNumber }
          : {}),
        ...(item.details?.covers ? { covers: item.details.covers } : {}),
        ...(item.details?.attendeeOrganization
          ? { attendeeOrganisation: item.details.attendeeOrganization }
          : {}),
      })),
  };
}
export function policyInputHash(input: PolicyInput): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
async function loadHierarchy(claimant: Actor): Promise<Actor[]> {
  const hierarchy: Actor[] = [];
  const visited = new Set([claimant.employeeId]);
  let managerId = claimant.reportingManagerId;
  while (managerId) {
    requireWorkflow(
      !visited.has(managerId),
      'REQUIRED_APPROVER_NOT_FOUND',
      'Reporting hierarchy contains a cycle.',
    );
    visited.add(managerId);
    const employee = await Employee.findById(managerId).lean().exec();
    requireWorkflow(
      employee,
      'REQUIRED_APPROVER_NOT_FOUND',
      'Reporting hierarchy is incomplete.',
    );
    const actor = employeeActor(employee);
    hierarchy.push(actor);
    managerId = actor.reportingManagerId;
  }
  return hierarchy;
}
export async function loadClaimPolicyContext(
  claimId: string,
): Promise<WorkflowContext> {
  requireWorkflow(
    isValidObjectId(claimId),
    'CLAIM_NOT_FOUND',
    'Claim was not found.',
  );
  const claim = await Claim.findById(claimId).lean().exec();
  requireWorkflow(claim, 'CLAIM_NOT_FOUND', 'Claim was not found.');
  const [travel, expenses, evidence, employee] = await Promise.all([
    TravelRequest.findById(claim.travelRequest).lean().exec(),
    Expense.find({ _id: { $in: claim.expenses } })
      .lean()
      .exec(),
    Evidence.find({ travelRequest: claim.travelRequest }).lean().exec(),
    Employee.findById(claim.employee).lean().exec(),
  ]);
  requireWorkflow(
    travel && employee,
    'CLAIM_STATE_CONFLICT',
    'Claim travel or employee reference is missing.',
  );
  const claimant = employeeActor(employee);
  const policyInput = assembleClaimPolicyInput(
    claim,
    travel,
    expenses,
    evidence,
  );
  return {
    claim: workflowClaim(claim),
    claimant,
    hierarchy: await loadHierarchy(claimant),
    policy: evaluateClaimPolicy(policyInput),
    policyInputHash: policyInputHash(policyInput),
  };
}
