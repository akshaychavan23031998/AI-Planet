import { Claim } from '../../modules/claims/claim.model.js';
import { requireWorkflow } from './errors.js';
import type { WorkflowClaim, WorkflowPlan } from './types.js';

export function workflowFilter(claim: WorkflowClaim) {
  // Pre-workflow seeded documents may lack these fields; missing is equivalent to their zero defaults.
  const cycleCondition =
    claim.reviewCycle === 0
      ? { $or: [{ reviewCycle: 0 }, { reviewCycle: { $exists: false } }] }
      : { reviewCycle: claim.reviewCycle };
  const versionCondition =
    claim.workflowVersion === 0
      ? {
          $or: [
            { workflowVersion: 0 },
            { workflowVersion: { $exists: false } },
          ],
        }
      : { workflowVersion: claim.workflowVersion };
  requireWorkflow(
    Number.isSafeInteger(claim.workflowVersion + 1),
    'CLAIM_STATE_CONFLICT',
    'Workflow version overflow.',
  );
  return {
    _id: claim.claimId,
    employee: claim.employeeId,
    status: claim.status,
    $and: [cycleCondition, versionCondition],
  };
}
export function conditionalWorkflowWrite(
  claim: WorkflowClaim,
  plan: WorkflowPlan,
) {
  return {
    filter: workflowFilter(claim),
    update: {
      $set: {
        status: plan.status,
        reviewCycle: plan.reviewCycle,
        reviewRoute: plan.reviewRoute,
        reviewInputHash: plan.reviewInputHash,
        ...(plan.finance ? { finance: plan.finance } : {}),
      },
      ...(plan.finance ? {} : { $unset: { finance: 1 as const } }),
      $inc: { workflowVersion: 1 },
      $push: {
        workflowHistory: plan.event,
        ...(plan.approval ? { approvals: plan.approval } : {}),
      },
    },
  };
}
export async function persistWorkflowTransition(
  claim: WorkflowClaim,
  plan: WorkflowPlan,
): Promise<void> {
  const { filter, update } = conditionalWorkflowWrite(claim, plan);
  const updated = await Claim.findOneAndUpdate(filter, update, {
    new: true,
    runValidators: true,
  })
    .select('_id')
    .lean()
    .exec();
  requireWorkflow(
    updated,
    'CLAIM_STATE_CONFLICT',
    'Claim changed while this action was being processed. Reload before retrying.',
  );
}
