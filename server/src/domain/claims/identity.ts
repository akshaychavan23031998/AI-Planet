import { Employee } from '../../modules/employees/employee.model.js';
import { requireWorkflow } from './errors.js';
import type { Actor } from './types.js';

export function employeeActor(employee: {
  _id: { toString(): string };
  employeeCode: string;
  name: string;
  organizationalRole: Actor['organizationalRole'];
  reportingManager?: { toString(): string } | null;
}): Actor {
  return {
    employeeId: employee._id.toString(),
    employeeCode: employee.employeeCode,
    name: employee.name,
    organizationalRole: employee.organizationalRole,
    reportingManagerId: employee.reportingManager?.toString() ?? null,
  };
}
export async function resolveDemoActor(employeeCode: string): Promise<Actor> {
  requireWorkflow(
    typeof employeeCode === 'string' && employeeCode.trim(),
    'IDENTITY_NOT_FOUND',
    'Employee code is required.',
  );
  const employee = await Employee.findOne({ employeeCode: employeeCode.trim() })
    .lean()
    .exec();
  requireWorkflow(
    employee,
    'IDENTITY_NOT_FOUND',
    'Employee code was not found.',
  );
  return employeeActor(employee);
}
