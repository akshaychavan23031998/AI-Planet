import { apiRequest } from './client';
import type { Claim, WorkflowResult } from './claimTypes';
async function queue(path: string, employeeCode: string, signal?: AbortSignal) {
  return (
    await apiRequest<{ data: Claim[] }>({
      path,
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export const getApprovals = (actor: string, signal?: AbortSignal) =>
  queue('/api/v1/approvals', actor, signal);
export const getFinanceClaims = (actor: string, signal?: AbortSignal) =>
  queue('/api/v1/finance/claims', actor, signal);
async function action(actor: string, id: string, suffix: string, body: object) {
  return (
    await apiRequest<{ data: WorkflowResult }>({
      path: `/api/v1/claims/${encodeURIComponent(id)}/${suffix}`,
      method: 'POST',
      employeeCode: actor,
      body,
    })
  ).data;
}
export const approveClaim = (actor: string, id: string, remarks?: string) =>
  action(actor, id, 'approve', remarks ? { remarks } : {});
export const returnClaim = (actor: string, id: string, remarks: string) =>
  action(actor, id, 'return', { remarks });
export const verifyClaim = (actor: string, id: string, remarks?: string) =>
  action(actor, id, 'finance/verify', remarks ? { remarks } : {});
export const schedulePayment = (
  actor: string,
  id: string,
  scheduledFor: string,
) => action(actor, id, 'finance/schedule-payment', { scheduledFor });
export const markPaid = (actor: string, id: string, paymentReference: string) =>
  action(actor, id, 'finance/mark-paid', { paymentReference });
