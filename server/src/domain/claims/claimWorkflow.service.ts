import { loadClaimPolicyContext } from './claimPolicyContext.js';
import { persistWorkflowTransition } from './claimWorkflow.persistence.js';
import { resolveDemoActor } from './identity.js';
import { requireWorkflow } from './errors.js';
import { planClaimTransition, settlementDirection } from './transitions.js';
import type { Actor, WorkflowCommand } from './types.js';

async function act(
  claimId: string,
  suppliedActor: Actor,
  command: WorkflowCommand,
) {
  // Re-resolve even an Actor argument: its caller-provided role/hierarchy never grants permissions.
  const actor = await resolveDemoActor(suppliedActor.employeeCode);
  requireWorkflow(
    actor.employeeId === suppliedActor.employeeId,
    'IDENTITY_NOT_FOUND',
    'Actor identity no longer matches Employee data.',
  );
  const context = await loadClaimPolicyContext(claimId);
  const plan = planClaimTransition(context, actor, command, new Date());
  await persistWorkflowTransition(context.claim, plan);
  return {
    claimId,
    action: command.action,
    previousStatus: context.claim.status,
    currentStatus: plan.status,
    reviewCycle: plan.reviewCycle,
    actor,
    workflowEvent: plan.event,
    settlementDirection: context.policy.isFinal
      ? settlementDirection(context.policy)
      : null,
  };
}
export function submitClaim(claimId: string, actor: Actor) {
  return act(claimId, actor, { action: 'SUBMITTED' });
}
export function resubmitClaim(claimId: string, actor: Actor) {
  return act(claimId, actor, { action: 'RESUBMITTED' });
}
export function approveClaim(claimId: string, actor: Actor, remarks?: string) {
  return act(claimId, actor, {
    action: 'APPROVED',
    ...(remarks === undefined ? {} : { remarks }),
  });
}
export function returnClaim(claimId: string, actor: Actor, remarks: string) {
  return act(claimId, actor, { action: 'RETURNED', remarks });
}
export function verifyClaimByFinance(
  claimId: string,
  actor: Actor,
  remarks?: string,
) {
  return act(claimId, actor, {
    action: 'FINANCE_VERIFIED',
    ...(remarks === undefined ? {} : { remarks }),
  });
}
export function schedulePayment(
  claimId: string,
  actor: Actor,
  scheduledFor: string,
) {
  return act(claimId, actor, { action: 'PAYMENT_SCHEDULED', scheduledFor });
}
export function markClaimPaid(
  claimId: string,
  actor: Actor,
  paymentReference: string,
) {
  return act(claimId, actor, { action: 'PAID', paymentReference });
}
