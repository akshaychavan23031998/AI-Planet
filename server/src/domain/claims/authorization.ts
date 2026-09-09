import { requireWorkflow } from './errors.js';
import type { Actor, ResolvedApprover, WorkflowClaim } from './types.js';

export function requireClaimant(claim: WorkflowClaim, actor: Actor): void {
  requireWorkflow(
    actor.employeeId === claim.employeeId,
    'NOT_CLAIMANT',
    'Only the claimant may submit or resubmit.',
  );
}
export function forbidSelfReview(claim: WorkflowClaim, actor: Actor): void {
  requireWorkflow(
    actor.employeeId !== claim.employeeId,
    'SELF_APPROVAL_FORBIDDEN',
    'A claimant cannot review their own claim.',
  );
}
export function requireApprover(
  claim: WorkflowClaim,
  actor: Actor,
  required: ResolvedApprover,
): void {
  forbidSelfReview(claim, actor);
  requireWorkflow(
    actor.employeeId === required.employeeId &&
      actor.organizationalRole === required.level,
    'NOT_REQUIRED_APPROVER',
    'Actor is not the resolved approver for the current stage.',
  );
}
export function requireFinance(claim: WorkflowClaim, actor: Actor): void {
  requireWorkflow(
    actor.organizationalRole === 'FINANCE',
    'FINANCE_ROLE_REQUIRED',
    'This action requires Finance.',
  );
  forbidSelfReview(claim, actor);
}
