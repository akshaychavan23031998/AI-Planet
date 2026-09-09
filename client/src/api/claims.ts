import { apiRequest } from './client';
import type { ClaimSummary } from './types';
export async function getClaims(employeeCode: string, signal?: AbortSignal) {
  return (
    await apiRequest<{ data: ClaimSummary[] }>({
      path: '/api/v1/claims',
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}

import type {
  Claim,
  ClaimValidation,
  ClaimReadiness,
  ClaimSettlement,
  ManualResolution,
  WorkflowResult,
} from './claimTypes';
async function readClaim<T>(
  employeeCode: string,
  claimId: string,
  suffix: string,
  signal?: AbortSignal,
) {
  return (
    await apiRequest<{ data: T }>({
      path: `/api/v1/claims/${encodeURIComponent(claimId)}${suffix}`,
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export const getClaim = (actor: string, id: string, signal?: AbortSignal) =>
  readClaim<Claim>(actor, id, '', signal);
export const getClaimValidation = (
  actor: string,
  id: string,
  signal?: AbortSignal,
) => readClaim<ClaimValidation>(actor, id, '/validation', signal);
export const getClaimReadiness = (
  actor: string,
  id: string,
  signal?: AbortSignal,
) => readClaim<ClaimReadiness>(actor, id, '/readiness', signal);
export const getClaimSettlement = (
  actor: string,
  id: string,
  signal?: AbortSignal,
) => readClaim<ClaimSettlement>(actor, id, '/settlement', signal);
async function writeClaim<T>(
  employeeCode: string,
  claimId: string,
  suffix: string,
  body?: unknown,
) {
  return (
    await apiRequest<{ data: T }>({
      path: `/api/v1/claims/${encodeURIComponent(claimId)}${suffix}`,
      employeeCode,
      method: 'POST',
      ...(body === undefined ? {} : { body }),
    })
  ).data;
}
export const excludeClaimExpense = (
  actor: string,
  id: string,
  expenseId: string,
  reason: string,
) =>
  writeClaim<Claim>(
    actor,
    id,
    `/expenses/${encodeURIComponent(expenseId)}/exclude`,
    { reason },
  );
export const restoreClaimExpense = (
  actor: string,
  id: string,
  expenseId: string,
) =>
  writeClaim<Claim>(
    actor,
    id,
    `/expenses/${encodeURIComponent(expenseId)}/restore`,
  );
export const resolveClaimExpense = (
  actor: string,
  id: string,
  expenseId: string,
  resolution: ManualResolution,
) =>
  writeClaim<Claim>(
    actor,
    id,
    `/expenses/${encodeURIComponent(expenseId)}/resolve`,
    {
      reimbursableMinor: resolution.reimbursableMinor,
      disallowedMinor: resolution.disallowedMinor,
      reason: resolution.reason,
    },
  );
export const submitClaim = (actor: string, id: string) =>
  writeClaim<WorkflowResult>(actor, id, '/submit');
export const resubmitClaim = (actor: string, id: string) =>
  writeClaim<WorkflowResult>(actor, id, '/resubmit');
