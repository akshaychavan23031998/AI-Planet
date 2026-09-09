import { apiRequest } from './client';
import type { Expense } from './types';
export async function getExpenses(
  employeeCode: string,
  tripId: string,
  signal?: AbortSignal,
) {
  return (
    await apiRequest<{ data: Expense[] }>({
      path: `/api/v1/travel-requests/${encodeURIComponent(tripId)}/expenses`,
      employeeCode,
      ...(signal ? { signal } : {}),
    })
  ).data;
}
