import type { PolicyEvidence, PolicyExpense } from './types.js';

const normalized = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export function detectDuplicates(
  expenses: readonly PolicyExpense[],
  evidence: readonly PolicyEvidence[],
): Map<string, string> {
  const duplicateTargets = new Map(
    evidence.flatMap((item) =>
      (item.relationships ?? [])
        .filter((relation) => relation.type === 'DUPLICATE_OF')
        .map((relation) => [item.key, relation.evidenceKey] as const),
    ),
  );
  const roots = (expense: PolicyExpense) =>
    expense.evidenceKeys.map((key) => duplicateTargets.get(key) ?? key);
  const duplicates = new Map<string, string>();
  const retained: PolicyExpense[] = [];
  // Prefer the original receipt over its explicitly identified duplicate, then a stable key.
  const ordered = [...expenses].sort(
    (a, b) =>
      Number(a.evidenceKeys.some((key) => duplicateTargets.has(key))) -
        Number(b.evidenceKeys.some((key) => duplicateTargets.has(key))) ||
      a.key.localeCompare(b.key, 'en'),
  );
  for (const expense of ordered) {
    const original = retained.find(
      (other) =>
        expense.employeeKey === other.employeeKey &&
        expense.paidBy === other.paidBy &&
        expense.category === other.category &&
        expense.componentType === other.componentType &&
        expense.expenseDate === other.expenseDate &&
        expense.amountMinor === other.amountMinor &&
        normalized(expense.merchant) === normalized(other.merchant) &&
        expense.lineReference === other.lineReference &&
        ((!!expense.billReference?.trim() &&
          normalized(expense.billReference) ===
            normalized(other.billReference ?? '')) ||
          expense.evidenceKeys.some(
            (key) =>
              duplicateTargets.has(key) &&
              roots(other).includes(duplicateTargets.get(key)!),
          )),
    );
    if (original) duplicates.set(expense.key, original.key);
    else retained.push(expense);
  }
  return duplicates;
}
