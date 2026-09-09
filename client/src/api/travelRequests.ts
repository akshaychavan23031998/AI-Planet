import { apiRequest } from './client';
import type { TravelRequest } from './types';
export async function getTravelRequests(
  employeeCode: string,
  signal?: AbortSignal,
) {
  return (
    await apiRequest<{ data: TravelRequest[] }>({
      path: '/api/v1/travel-requests',
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
export async function getTravelRequest(
  employeeCode: string,
  id: string,
  signal?: AbortSignal,
) {
  return (
    await apiRequest<{ data: TravelRequest }>({
      path: `/api/v1/travel-requests/${encodeURIComponent(id)}`,
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
