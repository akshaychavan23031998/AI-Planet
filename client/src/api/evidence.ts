import { apiRequest } from './client';
import type { Classification, Evidence } from './types';
export interface EvidenceFilters {
  kind?: Evidence['kind'];
  classification?: Classification;
}
export async function getEvidence(
  employeeCode: string,
  tripId: string,
  filters: EvidenceFilters = {},
  signal?: AbortSignal,
) {
  const search = new URLSearchParams();
  if (filters.kind) search.set('kind', filters.kind);
  if (filters.classification)
    search.set('classification', filters.classification);
  const suffix = search.size ? `?${search}` : '';
  return (
    await apiRequest<{ data: Evidence[] }>({
      path: `/api/v1/travel-requests/${encodeURIComponent(tripId)}/evidence${suffix}`,
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export async function getEvidenceDetail(
  employeeCode: string,
  id: string,
  signal?: AbortSignal,
) {
  return (
    await apiRequest<{ data: Evidence }>({
      path: `/api/v1/evidence/${encodeURIComponent(id)}`,
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
