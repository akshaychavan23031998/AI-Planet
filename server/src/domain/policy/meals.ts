import { finding } from './findings.js';
import { cityTier } from './lodging.js';
import { assertMinor, isBusinessDate, sumMinor } from './money.js';
import type { AmountEvaluation, PolicyExpense, PolicyInput } from './types.js';

export function evaluateMeals(
  expenses: readonly PolicyExpense[],
  travel: PolicyInput['travel'],
): Map<string, AmountEvaluation> {
  const result = new Map<string, AmountEvaluation>();
  const days = new Map<string, PolicyExpense[]>();
  for (const expense of expenses) {
    assertMinor(expense.amountMinor);
    if (expense.category !== 'MEAL')
      throw new TypeError('Meal evaluation accepts normal meals only');
    if (
      !isBusinessDate(expense.expenseDate) ||
      expense.expenseDate < travel.startDate ||
      expense.expenseDate > travel.endDate
    ) {
      result.set(expense.key, {
        knownEligibleMinor: 0,
        knownDisallowedMinor: 0,
        unresolvedMinor: expense.amountMinor,
        findings: [
          finding(
            'MEAL_DATE_OR_TIER_UNRESOLVED',
            'BLOCKING',
            'A meal needs a valid date within the travel period.',
            '§3.3',
            { expenseKey: expense.key },
          ),
        ],
      });
      continue;
    }
    const day = days.get(expense.expenseDate) ?? [];
    day.push(expense);
    days.set(expense.expenseDate, day);
  }
  for (const meals of days.values()) {
    const tiers = new Set(
      meals.map((expense) =>
        cityTier(
          expense.city ?? travel.destination,
          expense.cityTier ?? travel.cityTier,
        ),
      ),
    );
    if (tiers.size !== 1) {
      for (const expense of meals)
        result.set(expense.key, {
          knownEligibleMinor: 0,
          knownDisallowedMinor: 0,
          unresolvedMinor: expense.amountMinor,
          findings: [
            finding(
              'MEAL_DATE_OR_TIER_UNRESOLVED',
              'BLOCKING',
              'Resolve the applicable city tier for this day; multiple daily allowances are not assumed.',
              '§3.3',
              { expenseKey: expense.key },
            ),
          ],
        });
      continue;
    }
    sumMinor(meals.map((expense) => expense.amountMinor));
    const limit = tiers.has(1) ? 150000 : 100000;
    let remaining = limit;
    // Stable key order allocates a single daily cap across lines without fractional arithmetic.
    for (const expense of [...meals].sort((a, b) =>
      a.key.localeCompare(b.key, 'en'),
    )) {
      const eligible = Math.min(expense.amountMinor, remaining);
      remaining -= eligible;
      const disallowed = expense.amountMinor - eligible;
      result.set(expense.key, {
        knownEligibleMinor: eligible,
        knownDisallowedMinor: disallowed,
        unresolvedMinor: 0,
        findings: disallowed
          ? [
              finding(
                'MEAL_DAILY_LIMIT_EXCEEDED',
                'WARNING',
                'Combined normal meals exceed the daily actuals limit.',
                '§3.3',
                {
                  expenseKey: expense.key,
                  evidenceKeys: expense.evidenceKeys,
                  metadata: { dailyLimitMinor: limit },
                },
              ),
            ]
          : [],
      });
    }
  }
  return result;
}
