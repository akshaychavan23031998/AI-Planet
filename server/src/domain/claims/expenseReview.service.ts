import { Claim } from '../../modules/claims/claim.model.js';
import {
  assembleClaimPolicyInput,
  loadClaimData,
  workflowClaim,
} from './claimPolicyContext.js';
import { requireClaimant } from './authorization.js';
import { requireWorkflow, WorkflowError } from './errors.js';
import { resolveDemoActor } from './identity.js';
import { workflowFilter } from './claimWorkflow.persistence.js';
import { cityTier, evaluateLodging } from '../policy/lodging.js';
import type { Actor } from './types.js';

export type ReviewCommand =
  | { action: 'EXCLUDED'; reason: string }
  | { action: 'RESTORED' }
  | {
      action: 'RESOLVED';
      reimbursableMinor: number;
      disallowedMinor: number;
      reason: string;
    };

export async function reviewClaimExpense(
  claimId: string,
  expenseId: string,
  suppliedActor: Actor,
  command: ReviewCommand,
) {
  const actor = await resolveDemoActor(suppliedActor.employeeCode);
  requireWorkflow(
    actor.employeeId === suppliedActor.employeeId,
    'IDENTITY_NOT_FOUND',
    'Actor identity no longer matches.',
  );
  const data = await loadClaimData(claimId);
  const state = workflowClaim(data.claim);
  requireClaimant(state, actor);
  requireWorkflow(
    ['DRAFT', 'RETURNED'].includes(state.status),
    'ACTION_NOT_ALLOWED',
    'Expense review edits require DRAFT or RETURNED.',
  );
  const expense = data.expenses.find(
    (item) => item._id.toString() === expenseId,
  );
  requireWorkflow(
    expense && data.claim.expenses.some((id) => id.toString() === expenseId),
    'EXPENSE_NOT_FOUND',
    'Expense is not part of this claim.',
  );
  const input = assembleClaimPolicyInput(
    data.claim,
    data.travel,
    data.expenses,
    data.evidence,
  );
  const previous = data.claim.expenseReviews?.find(
    (item) => item.expense.toString() === expenseId,
  );
  const resolution =
    command.action === 'RESOLVED'
      ? {
          reimbursableMinor: command.reimbursableMinor,
          disallowedMinor: command.disallowedMinor,
          reason: command.reason.trim(),
        }
      : undefined;
  if (resolution) {
    requireWorkflow(
      expense.componentType === 'HOTEL_MIXED_TAX',
      'INVALID_MANUAL_RESOLUTION',
      'This expense does not support an amount allocation.',
    );
    try {
      evaluateLodging(
        {
          ...input.expenses.find((item) => item.key === expenseId)!,
          hotelTaxResolution: { ...resolution, note: resolution.reason },
        },
        cityTier(data.travel.destination),
      );
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      throw new WorkflowError(
        'INVALID_MANUAL_RESOLUTION',
        'Allocation must use non-negative integer paise, total the source amount and include a reason.',
      );
    }
  }
  requireWorkflow(
    command.action !== 'EXCLUDED' || command.reason.trim(),
    'ACTION_NOT_ALLOWED',
    'An exclusion reason is required.',
  );
  const now = new Date();
  const review = {
    expense: expense._id,
    included:
      command.action === 'EXCLUDED'
        ? false
        : command.action === 'RESTORED'
          ? true
          : (previous?.included ?? true),
    ...(command.action === 'EXCLUDED'
      ? { exclusionReason: command.reason.trim() }
      : command.action === 'RESOLVED' && previous?.exclusionReason
        ? { exclusionReason: previous.exclusionReason }
        : {}),
    ...(resolution
      ? { manualResolution: resolution }
      : previous?.manualResolution
        ? { manualResolution: previous.manualResolution }
        : {}),
    updatedBy: data.employee._id,
    updatedAt: now,
  };
  const history = {
    action: command.action,
    expense: expense._id,
    actor: data.employee._id,
    occurredAt: now,
    ...('reason' in command ? { reason: command.reason.trim() } : {}),
    ...(resolution ? { resolution } : {}),
  };
  const reviews = [
    ...(data.claim.expenseReviews ?? []).filter(
      (item) => item.expense.toString() !== expenseId,
    ),
    review,
  ];
  const updated = await Claim.findOneAndUpdate(
    workflowFilter(state),
    {
      $set: { expenseReviews: reviews },
      $push: { expenseReviewHistory: history },
      $inc: { workflowVersion: 1 },
    },
    { new: true, runValidators: true },
  )
    .lean()
    .exec();
  requireWorkflow(
    updated,
    'CLAIM_STATE_CONFLICT',
    'Claim changed while this review edit was being processed.',
  );
  return { claim: updated, employee: data.employee };
}
