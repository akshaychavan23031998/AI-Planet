import type { ApprovalLevel } from '../policy/types.js';
import { isBusinessDate } from '../policy/money.js';
import {
  requireApprover,
  requireClaimant,
  requireFinance,
} from './authorization.js';
import { resolveApprovers } from './approvers.js';
import { requireWorkflow } from './errors.js';
import type {
  Actor,
  ClaimStatus,
  ResolvedApprover,
  WorkflowCommand,
  WorkflowContext,
  WorkflowPlan,
} from './types.js';

export const reviewStatuses: Record<ApprovalLevel, ClaimStatus> = {
  REPORTING_MANAGER: 'MANAGER_REVIEW',
  HEAD_OF_DEPARTMENT: 'HOD_REVIEW',
  HEAD_OF_DIVISION: 'DIVISION_REVIEW',
  MANAGING_DIRECTOR: 'MD_REVIEW',
};
export function settlementDirection(
  policy: WorkflowContext['policy'],
): 'PAYABLE' | 'RECOVERABLE' | 'ZERO' {
  requireWorkflow(
    policy.isFinal,
    'POLICY_NOT_READY',
    'Settlement is not final.',
  );
  return policy.payableMinor > 0
    ? 'PAYABLE'
    : policy.recoverableMinor > 0
      ? 'RECOVERABLE'
      : 'ZERO';
}
function requireReady(context: WorkflowContext): void {
  requireWorkflow(
    context.policy.isFinal && context.policy.readiness.isReadyToSubmit,
    'POLICY_NOT_READY',
    'Current policy evaluation blocks submission or settlement.',
  );
}
function currentRoute(context: WorkflowContext): ResolvedApprover[] {
  const { claim } = context;
  requireWorkflow(
    claim.reviewCycle > 0 && claim.reviewRoute.length > 0,
    'CLAIM_STATE_CONFLICT',
    'No active business review route.',
  );
  const liveRoute = resolveApprovers(
    context.claimant,
    claim.reviewRoute.map((item) => item.level),
    context.hierarchy,
  );
  requireWorkflow(
    JSON.stringify(liveRoute) === JSON.stringify(claim.reviewRoute),
    'CLAIM_STATE_CONFLICT',
    'Assigned approver hierarchy changed during this review cycle.',
  );
  return liveRoute;
}
function approved(
  context: WorkflowContext,
  approver: ResolvedApprover,
): boolean {
  return context.claim.approvals.some(
    (record) =>
      record.reviewCycle === context.claim.reviewCycle &&
      record.level === approver.level &&
      record.approver === approver.employeeId &&
      record.decision === 'APPROVED',
  );
}
function requireApproved(
  context: WorkflowContext,
  route: readonly ResolvedApprover[],
): void {
  requireWorkflow(
    route.every((item) => approved(context, item)),
    'ACTION_NOT_ALLOWED',
    'Required current-cycle business approvals are incomplete.',
  );
}
function requireReviewedInput(context: WorkflowContext): void {
  requireWorkflow(
    context.claim.reviewInputHash === context.policyInputHash,
    'CLAIM_STATE_CONFLICT',
    'Financial or evidence context changed; approvals cannot be reused.',
  );
  requireReady(context);
  const expectedRoute = resolveApprovers(
    context.claimant,
    context.policy.requiredClaimApprovalLevels,
    context.hierarchy,
  );
  requireWorkflow(
    JSON.stringify(expectedRoute) === JSON.stringify(context.claim.reviewRoute),
    'CLAIM_STATE_CONFLICT',
    'Required approval route changed.',
  );
}
function indiaDate(now: Date): string {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function planClaimTransition(
  context: WorkflowContext,
  actor: Actor,
  command: WorkflowCommand,
  now: Date,
): WorkflowPlan {
  const { claim } = context;
  requireWorkflow(
    Number.isFinite(now.getTime()),
    'ACTION_NOT_ALLOWED',
    'A valid action timestamp is required.',
  );
  requireWorkflow(
    context.claimant.employeeId === claim.employeeId,
    'CLAIM_STATE_CONFLICT',
    'Claimant context is inconsistent.',
  );
  let plan: WorkflowPlan = {
    status: claim.status,
    reviewCycle: claim.reviewCycle,
    reviewRoute: claim.reviewRoute,
    reviewInputHash: claim.reviewInputHash,
    finance: claim.finance,
    event: {
      action: command.action,
      fromStatus: claim.status,
      toStatus: claim.status,
      actor: actor.employeeId,
      actorRole: actor.organizationalRole,
      occurredAt: new Date(now),
      reviewCycle: claim.reviewCycle,
      ...('remarks' in command && command.remarks?.trim()
        ? { remarks: command.remarks.trim() }
        : {}),
    },
  };
  if (command.action === 'SUBMITTED' || command.action === 'RESUBMITTED') {
    requireClaimant(claim, actor);
    requireWorkflow(
      claim.status === (command.action === 'SUBMITTED' ? 'DRAFT' : 'RETURNED'),
      'ACTION_NOT_ALLOWED',
      'Claim is not in the required submission state.',
    );
    requireWorkflow(
      command.action !== 'SUBMITTED' || claim.reviewCycle === 0,
      'CLAIM_STATE_CONFLICT',
      'Draft has unexpected prior review metadata.',
    );
    requireReady(context);
    const route = resolveApprovers(
      context.claimant,
      context.policy.requiredClaimApprovalLevels,
      context.hierarchy,
    );
    requireWorkflow(
      route[0],
      'REQUIRED_APPROVER_NOT_FOUND',
      'A business approval stage is required.',
    );
    const cycle = claim.reviewCycle + 1;
    requireWorkflow(
      Number.isSafeInteger(cycle),
      'CLAIM_STATE_CONFLICT',
      'Review cycle overflow.',
    );
    plan = {
      ...plan,
      status: reviewStatuses[route[0].level],
      reviewCycle: cycle,
      reviewRoute: route,
      reviewInputHash: context.policyInputHash,
      finance: null,
    };
  } else {
    requireWorkflow(
      !['DRAFT', 'RETURNED', 'PAID'].includes(claim.status),
      'ACTION_NOT_ALLOWED',
      'This state does not accept review or Finance actions.',
    );
    const route = currentRoute(context);
    const stageIndex = route.findIndex(
      (item) => reviewStatuses[item.level] === claim.status,
    );
    if (command.action === 'APPROVED' || command.action === 'RETURNED') {
      requireWorkflow(
        stageIndex >= 0 ||
          (command.action === 'RETURNED' && claim.status === 'FINANCE_REVIEW'),
        'ACTION_NOT_ALLOWED',
        'Claim is not in an actionable review stage.',
      );
      const required = route[stageIndex];
      if (required) requireApprover(claim, actor, required);
      else requireFinance(claim, actor);
      if (command.action === 'RETURNED') {
        requireWorkflow(
          command.remarks.trim(),
          'RETURN_REMARKS_REQUIRED',
          'Return remarks are required.',
        );
        plan = { ...plan, status: 'RETURNED' };
      } else {
        requireReviewedInput(context);
        requireApproved(context, route.slice(0, stageIndex));
        requireWorkflow(
          required,
          'ACTION_NOT_ALLOWED',
          'No current business approval stage.',
        );
        requireWorkflow(
          !claim.approvals.some(
            (item) =>
              item.level === required.level &&
              item.reviewCycle === claim.reviewCycle,
          ),
          'CLAIM_STATE_CONFLICT',
          'This approval level already has a current-cycle decision.',
        );
        const next = route[stageIndex + 1];
        plan = {
          ...plan,
          status: next ? reviewStatuses[next.level] : 'FINANCE_REVIEW',
        };
      }
      if (required)
        plan.approval = {
          level: required.level,
          approver: actor.employeeId,
          decision: command.action,
          decidedAt: new Date(now),
          reviewCycle: claim.reviewCycle,
          ...(command.remarks?.trim()
            ? { remarks: command.remarks.trim() }
            : {}),
        };
    } else {
      requireFinance(claim, actor);
      requireWorkflow(
        claim.status ===
          (command.action === 'PAID' ? 'PAYMENT_SCHEDULED' : 'FINANCE_REVIEW'),
        'ACTION_NOT_ALLOWED',
        'Claim is not in the required Finance state.',
      );
      requireReviewedInput(context);
      requireApproved(context, route);
      if (command.action === 'FINANCE_VERIFIED') {
        requireWorkflow(
          !claim.finance,
          'CLAIM_STATE_CONFLICT',
          'Finance verification was already recorded.',
        );
        plan = {
          ...plan,
          finance: {
            verifiedBy: actor.employeeId,
            verifiedAt: new Date(now),
            reviewCycle: claim.reviewCycle,
          },
        };
      } else {
        requireWorkflow(
          claim.finance?.verifiedAt &&
            claim.finance.reviewCycle === claim.reviewCycle,
          'ACTION_NOT_ALLOWED',
          'Current-cycle Finance verification is required.',
        );
        requireWorkflow(
          settlementDirection(context.policy) === 'PAYABLE',
          'ACTION_NOT_ALLOWED',
          'Recoverable and zero settlements do not create reimbursement payments.',
        );
        if (command.action === 'PAYMENT_SCHEDULED') {
          requireWorkflow(
            isBusinessDate(command.scheduledFor) &&
              ['10', '25'].includes(command.scheduledFor.slice(-2)) &&
              command.scheduledFor >= indiaDate(now),
            'INVALID_PAYMENT_DATE',
            'Use a valid non-past payment-run date on the 10th or 25th.',
          );
          plan = {
            ...plan,
            status: 'PAYMENT_SCHEDULED',
            finance: {
              ...claim.finance,
              paymentScheduledFor: command.scheduledFor,
              paymentScheduledBy: actor.employeeId,
            },
          };
        } else {
          requireWorkflow(
            command.paymentReference.trim(),
            'PAYMENT_REFERENCE_REQUIRED',
            'Payment reference is required.',
          );
          requireWorkflow(
            claim.finance.paymentScheduledFor &&
              claim.finance.paymentScheduledBy &&
              claim.finance.paymentScheduledFor <= indiaDate(now),
            'ACTION_NOT_ALLOWED',
            'A scheduled payment must exist and its date must have arrived.',
          );
          plan = {
            ...plan,
            status: 'PAID',
            finance: {
              ...claim.finance,
              paidAt: new Date(now),
              paymentReference: command.paymentReference.trim(),
            },
          };
        }
      }
    }
  }
  return {
    ...plan,
    event: {
      ...plan.event,
      toStatus: plan.status,
      reviewCycle: plan.reviewCycle,
    },
  };
}
