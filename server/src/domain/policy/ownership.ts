import { finding } from './findings.js';
import type { PolicyExpense, PolicyFinding } from './types.js';

export function validateOwnership(
  expense: PolicyExpense,
  claimantKey: string,
): PolicyFinding[] {
  return expense.employeeKey === claimantKey
    ? []
    : [
        finding(
          'CLAIMANT_MISMATCH',
          'BLOCKING',
          'This expense belongs to another person and cannot reimburse the claimant.',
          '§4',
          { expenseKey: expense.key, evidenceKeys: expense.evidenceKeys },
        ),
      ];
}
