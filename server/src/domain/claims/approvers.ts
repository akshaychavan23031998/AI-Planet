import type { ApprovalLevel } from '../policy/types.js';
import { requireWorkflow } from './errors.js';
import { businessLevels } from './types.js';
import type { Actor, ResolvedApprover } from './types.js';

export function resolveApprovers(
  claimant: Actor,
  required: readonly ApprovalLevel[],
  hierarchy: readonly Actor[],
): ResolvedApprover[] {
  const ownLevel = businessLevels.findIndex(
    (level) => level === claimant.organizationalRole,
  );
  const effective = new Set(
    required.filter((level) => businessLevels.indexOf(level) > ownLevel),
  );
  if (required.some((level) => businessLevels.indexOf(level) <= ownLevel)) {
    const next = businessLevels[ownLevel + 1];
    requireWorkflow(
      next,
      'REQUIRED_APPROVER_NOT_FOUND',
      'No higher approval level is established for this claimant.',
    );
    effective.add(next);
  }
  const ancestors: Actor[] = [];
  const visited = new Set([claimant.employeeId]);
  let managerId = claimant.reportingManagerId;
  while (managerId) {
    requireWorkflow(
      !visited.has(managerId),
      'REQUIRED_APPROVER_NOT_FOUND',
      'Reporting hierarchy contains a cycle.',
    );
    visited.add(managerId);
    const manager = hierarchy.find(
      (employee) => employee.employeeId === managerId,
    );
    requireWorkflow(
      manager,
      'REQUIRED_APPROVER_NOT_FOUND',
      'Reporting hierarchy is incomplete.',
    );
    ancestors.push(manager);
    managerId = manager.reportingManagerId;
  }
  return businessLevels
    .filter((level) => effective.has(level))
    .map((level) => {
      const approver = ancestors.find(
        (employee) => employee.organizationalRole === level,
      );
      requireWorkflow(
        approver,
        'REQUIRED_APPROVER_NOT_FOUND',
        `Required ${level} is absent from the claimant hierarchy.`,
      );
      return { level, employeeId: approver.employeeId };
    });
}
