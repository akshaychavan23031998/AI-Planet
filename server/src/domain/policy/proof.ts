import { finding } from './findings.js';
import type { PolicyEvidence, PolicyExpense, PolicyFinding } from './types.js';

export function hasProof(
  expense: PolicyExpense,
  evidence: readonly PolicyEvidence[],
): boolean {
  return expense.evidenceKeys.some((key) =>
    evidence.some(
      (item) =>
        item.key === key &&
        [
          'COMPANY_PAID_COST',
          'EMPLOYEE_PAID_CANDIDATE',
          'NEEDS_REVIEW',
          'SUPPORTING_DOCUMENT',
        ].includes(item.classification),
    ),
  );
}
export function validateProof(
  expense: PolicyExpense,
  evidence: readonly PolicyEvidence[],
): PolicyFinding[] {
  return hasProof(expense, evidence)
    ? []
    : [
        finding(
          'MISSING_PROOF',
          'BLOCKING',
          'Link a specific supporting document; booking, failure, noise or a vague label is not paid-expense proof.',
          expense.category === 'MEAL' && expense.amountMinor > 50000
            ? '§3.3 / §5.2'
            : '§5.2',
          { expenseKey: expense.key, evidenceKeys: expense.evidenceKeys },
        ),
      ];
}
