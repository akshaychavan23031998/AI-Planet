import { finding } from './findings.js';
import { assertMinor, sumMinor } from './money.js';
import type { AmountEvaluation, CityTier, PolicyExpense } from './types.js';

export function cityTier(city: string, supplied?: CityTier): CityTier {
  if (supplied !== undefined && ![1, 2, 3].includes(supplied))
    throw new RangeError('Invalid city tier');
  if (
    [
      'bengaluru',
      'mumbai',
      'delhi ncr',
      'hyderabad',
      'chennai',
      'pune',
      'kolkata',
    ].includes(city.trim().toLowerCase())
  )
    return 1;

  // The policy explicitly places other cities in the Tier 3/others band unless classified.
  return supplied ?? 3;
}
export function evaluateLodging(
  expense: PolicyExpense,
  tier: CityTier,
): AmountEvaluation {
  assertMinor(expense.amountMinor);
  const context = {
    expenseKey: expense.key,
    evidenceKeys: expense.evidenceKeys,
  };
  if (
    expense.componentType === 'LAUNDRY' ||
    expense.componentType === 'MINIBAR'
  )
    return {
      knownEligibleMinor: 0,
      knownDisallowedMinor: expense.amountMinor,
      unresolvedMinor: 0,
      findings: [
        finding(
          expense.componentType === 'LAUNDRY'
            ? 'NON_REIMBURSABLE_LAUNDRY'
            : 'NON_REIMBURSABLE_MINIBAR',
          'WARNING',
          'This hotel component is fully non-reimbursable; its source amount is retained.',
          '§4',
          context,
        ),
      ],
    };
  if (expense.componentType === 'HOTEL_MIXED_TAX') {
    const resolution = expense.hotelTaxResolution;
    if (!resolution)
      return {
        knownEligibleMinor: 0,
        knownDisallowedMinor: 0,
        unresolvedMinor: expense.amountMinor,
        findings: [
          finding(
            'HOTEL_TAX_ALLOCATION_UNRESOLVED',
            'BLOCKING',
            'Provide an evidenced complete tax allocation or explicitly exclude this line.',
            '§3.1 / §4',
            context,
          ),
        ],
      };
    if (
      sumMinor([resolution.reimbursableMinor, resolution.disallowedMinor]) !==
        expense.amountMinor ||
      !resolution.note.trim()
    ) {
      throw new RangeError(
        'Tax resolution requires a note and non-negative integer allocations equal to the source amount',
      );
    }
    return {
      knownEligibleMinor: resolution.reimbursableMinor,
      knownDisallowedMinor: resolution.disallowedMinor,
      unresolvedMinor: 0,
      findings: [
        finding(
          'HOTEL_TAX_ALLOCATION_RECORDED',
          'INFO',
          'Calculation uses the explicit manual tax allocation supplied for this evaluation.',
          '§3.1 / §4',
          context,
        ),
      ],
    };
  }
  if (expense.componentType !== 'ROOM' || ![1, 2, 3].includes(tier))
    throw new TypeError('Expected a room and valid city tier');
  const limit = tier === 1 ? 600000 : tier === 2 ? 400000 : 280000;
  const disallowed = Math.max(0, expense.amountMinor - limit);
  return {
    knownEligibleMinor: Math.min(expense.amountMinor, limit),
    knownDisallowedMinor: disallowed,
    unresolvedMinor: 0,
    findings: disallowed
      ? [
          finding(
            'LODGING_OVER_LIMIT',
            'WARNING',
            'Room tariff above the nightly limit is disallowed, excluding taxes.',
            '§3.1',
            { ...context, metadata: { limitMinor: limit } },
          ),
        ]
      : [],
  };
}
