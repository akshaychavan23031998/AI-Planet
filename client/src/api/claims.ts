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
