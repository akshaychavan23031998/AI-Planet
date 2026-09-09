import { apiRequest } from './client';
export interface DemoEmployee {
  id: string;
  employeeCode: string;
  name: string;
  organizationalRole:
    | 'EMPLOYEE'
    | 'REPORTING_MANAGER'
    | 'HEAD_OF_DEPARTMENT'
    | 'HEAD_OF_DIVISION'
    | 'MANAGING_DIRECTOR'
    | 'FINANCE';
}
export interface DemoUsersResponse {
  data: DemoEmployee[];
  meta: { count: number };
}
export async function getDemoUsers(
  signal?: AbortSignal,
): Promise<DemoEmployee[]> {
  const result = await apiRequest<DemoUsersResponse>({
    path: '/api/v1/demo/users',
    ...(signal ? { signal } : {}),
  });
  return result.data;
}
