import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalEmails,
  canonicalExpenses,
  canonicalImages,
  canonicalRelationships,
} from '../../seed/assignmentPack/canonicalData.js';
import { assessAdvanceCap } from './advance.js';
import { requiredApprovalLevels } from './approvals.js';
import { detectDuplicates } from './duplicates.js';
import { evaluateClaimPolicy } from './evaluateClaim.js';
import { cityTier, evaluateLodging } from './lodging.js';
import { sumMinor } from './money.js';
import { adjustAdvance, calculateSettlement } from './settlement.js';
import type { ApprovalLevel, PolicyExpense, PolicyInput } from './types.js';

function canonicalInput(): PolicyInput {
  return {
    claimantKey: 'NX4471',
    travel: {
      travelRequestId: null,
      destination: 'Bengaluru',
      startDate: '2026-06-16',
      endDate: '2026-06-20',
      bookingDate: '2026-06-11',
      travelType: 'DOMESTIC',
      estimatedSpendMinor: 4800000,
      advanceMinor: 2000000,
      preTravelApprovals: [
        {
          level: 'REPORTING_MANAGER',
          decision: 'APPROVED',
          approvedAt: '2026-06-08T18:40:55+05:30',
          evidenceKey: 'evidence-email-02',
        },
      ],
    },
    evidence: [
      ...canonicalEmails.map((item) => ({
        key: item.seedKey,
        classification: item.classification,
        relationships: canonicalRelationships
          .filter((relation) => relation.from === item.seedKey)
          .map((relation) => ({
            type: relation.type,
            evidenceKey: relation.to,
          })),
      })),
      ...canonicalImages.map((item) => ({
        key: item.seedKey,
        classification: 'SUPPORTING_DOCUMENT' as const,
      })),
    ],
    expenses: canonicalExpenses.map((item) => ({
      key: item.seedKey,
      employeeKey: 'NX4471',
      category: item.category,
      componentType: item.componentType,
      amountMinor: item.amountMinor,
      currency: item.currency,
      paidBy: item.paidBy,
      expenseDate: item.expenseDate ?? null,
      merchant: item.merchant,
      evidenceKeys: [...item.evidenceKeys],
      sourceReviewState: item.sourceReviewState,
      ...(item.occurredAt ? { occurredAt: item.occurredAt.toISOString() } : {}),
      ...(item.details?.invoiceNumber
        ? { billReference: item.details.invoiceNumber }
        : {}),
      ...(item.details?.covers ? { covers: item.details.covers } : {}),
      ...(item.details?.attendeeOrganization
        ? { attendeeOrganisation: item.details.attendeeOrganization }
        : {}),
    })),
  };
}
function expense(overrides: Partial<PolicyExpense> = {}): PolicyExpense {
  return {
    key: 'line-a',
    employeeKey: 'claimant',
    category: 'LOCAL_CONVEYANCE',
    componentType: 'RIDE',
    amountMinor: 17200,
    currency: 'INR',
    paidBy: 'EMPLOYEE',
    expenseDate: '2026-06-18',
    merchant: 'Cab merchant',
    evidenceKeys: ['receipt'],
    ...overrides,
  };
}
function input(expenses: PolicyExpense[] = [expense()]): PolicyInput {
  return {
    claimantKey: 'claimant',
    travel: {
      travelRequestId: 'hypothetical-reviewed-request',
      destination: 'Bengaluru',
      startDate: '2026-06-16',
      endDate: '2026-06-20',
      travelType: 'DOMESTIC',
      estimatedSpendMinor: 100000,
      estimatedEmployeeBorneMinor: 100000,
      advanceMinor: 0,
      preTravelApprovals: [
        {
          level: 'REPORTING_MANAGER',
          decision: 'APPROVED',
          approvedAt: '2026-06-08T12:00:00+05:30',
          evidenceKey: 'approval',
        },
      ],
    },
    evidence: [
      { key: 'receipt', classification: 'SUPPORTING_DOCUMENT' },
      { key: 'approval', classification: 'APPROVAL' },
    ],
    expenses,
  };
}
const meal = (overrides: Partial<PolicyExpense> = {}) =>
  expense({ category: 'MEAL', componentType: 'IN_ROOM_DINING', ...overrides });
const dinner = (overrides: Partial<PolicyExpense> = {}) =>
  expense({
    category: 'BUSINESS_ENTERTAINMENT',
    componentType: 'DINNER',
    amountMinor: 225500,
    covers: 4,
    attendeeOrganisation: 'Vertex procurement team',
    occurredAt: '2026-06-18T21:38:00+05:30',
    ...overrides,
  });
const hotelTax = (overrides: Partial<PolicyExpense> = {}) =>
  expense({
    category: 'OTHER',
    componentType: 'HOTEL_MIXED_TAX',
    expenseDate: null,
    amountMinor: 230400,
    ...overrides,
  });
const hasCode = (
  result: ReturnType<typeof evaluateClaimPolicy>,
  code: string,
) => result.findings.some((item) => item.code === code);

// These import only Task 4's plain fixture constants; no model, environment or database is loaded at runtime.
test('canonical initial evaluation preserves raw totals and material uncertainty', () => {
  const source = canonicalInput();
  const before = structuredClone(source);
  const result = evaluateClaimPolicy(source);
  assert.equal(result.expenseResults.length, 14);
  assert.equal(result.employeePaidGrossMinor, 2731804);
  assert.equal(result.companyPaidGrossMinor, 1055600);
  assert.equal(result.knownEligibleMinor, 2192904);
  assert.equal(result.knownDisallowedMinor, 83000);
  assert.equal(result.unresolvedMinor, 455900);
  assert.equal(result.advanceMinor, 2000000);
  assert.equal(result.isFinal, false);
  assert.equal(result.readiness.isReadyToSubmit, false);
  assert.equal(result.payableMinor, null);
  assert.equal(result.recoverableMinor, null);
  for (const code of [
    'MISSING_TRAVEL_REQUEST_ID',
    'MISSING_PRETRAVEL_HOD_APPROVAL',
    'ADVANCE_CAP_UNDETERMINED',
    'HOTEL_TAX_ALLOCATION_UNRESOLVED',
    'BUSINESS_ENTERTAINMENT_ATTENDEE_NAMES_MISSING',
    'BUSINESS_ENTERTAINMENT_HOD_APPROVAL_MISSING',
  ])
    assert.ok(hasCode(result, code), code);
  assert.deepEqual(source, before);
});

test('canonical four Ubers and two company flights have distinct contributions', () => {
  const result = evaluateClaimPolicy(canonicalInput());
  const ubers = result.expenseResults.filter((item) =>
    item.expenseKey.startsWith('expense-uber'),
  );
  assert.deepEqual(
    ubers.map((item) => item.sourceAmountMinor),
    [141502, 74300, 17200, 122902],
  );
  assert.equal(sumMinor(ubers.map((item) => item.knownEligibleMinor)), 355904);
  const flights = result.expenseResults.filter((item) =>
    item.expenseKey.startsWith('expense-flight'),
  );
  assert.equal(flights.length, 2);
  assert.equal(
    sumMinor(flights.map((item) => item.companyPaidMemoMinor)),
    1055600,
  );
  assert.equal(
    sumMinor(
      flights.map(
        (item) => item.knownEligibleMinor + item.employeePaidCandidateMinor,
      ),
    ),
    0,
  );
  assert.ok(flights.every((item) => item.status === 'COMPANY_PAID'));
});

test('canonical three room nights pass separately and source CLEAR does not mean eligible', () => {
  const result = evaluateClaimPolicy(canonicalInput());
  const rooms = result.expenseResults.filter((item) =>
    item.expenseKey.startsWith('expense-hotel-room'),
  );
  assert.equal(rooms.length, 3);
  assert.equal(sumMinor(rooms.map((item) => item.knownEligibleMinor)), 1725000);
  assert.ok(rooms.every((item) => item.knownDisallowedMinor === 0));
  for (const [key, amount] of [
    ['laundry', 45000],
    ['minibar', 38000],
  ] as const) {
    const row = result.expenseResults.find(
      (item) => item.expenseKey === `expense-hotel-${key}`,
    )!;
    assert.equal(row.knownEligibleMinor, 0);
    assert.equal(row.sourceAmountMinor, amount);
    assert.equal(row.knownDisallowedMinor, amount);
  }
});

for (const [amount, eligible, disallowed] of [
  [575000, 575000, 0],
  [650000, 600000, 50000],
]) {
  test(`Tier 1 room tariff ${amount} is capped with an explicit excess finding`, () => {
    const result = evaluateClaimPolicy(
      input([
        expense({
          category: 'LODGING',
          componentType: 'ROOM',
          amountMinor: amount!,
        }),
      ]),
    );
    assert.equal(result.knownEligibleMinor, eligible);
    assert.equal(result.knownDisallowedMinor, disallowed);
    assert.equal(hasCode(result, 'LODGING_OVER_LIMIT'), !!disallowed);
  });
}

test('other lodging tiers and unknown cities use documented limits', () => {
  assert.equal(cityTier(' Bengaluru ', 3), 1);
  assert.equal(cityTier('Other city'), 3);
  assert.equal(
    evaluateLodging(expense({ componentType: 'ROOM', amountMinor: 450000 }), 2)
      .knownEligibleMinor,
    400000,
  );
  assert.equal(
    evaluateLodging(expense({ componentType: 'ROOM', amountMinor: 300000 }), 3)
      .knownEligibleMinor,
    280000,
  );
});

test('mixed tax stays entirely unresolved without an explicit allocation', () => {
  const result = evaluateClaimPolicy(input([hotelTax()]));
  assert.equal(result.unresolvedMinor, 230400);
  assert.equal(result.knownEligibleMinor, 0);
  assert.equal(result.knownDisallowedMinor, 0);
  assert.equal(result.isFinal, false);
  assert.equal(result.payableMinor, null);
});

test('complete manual tax allocation is applied only to the supplied evaluation', () => {
  const result = evaluateClaimPolicy(
    input([
      hotelTax({
        hotelTaxResolution: {
          reimbursableMinor: 200000,
          disallowedMinor: 30400,
          note: 'Hypothetical evidenced review',
        },
      }),
    ]),
  );
  assert.equal(result.knownEligibleMinor, 200000);
  assert.equal(result.knownDisallowedMinor, 30400);
  assert.equal(result.unresolvedMinor, 0);
  assert.equal(result.isFinal, true);
  assert.ok(hasCode(result, 'HOTEL_TAX_ALLOCATION_RECORDED'));
});

for (const allocation of [
  { reimbursableMinor: 200000, disallowedMinor: 0, note: 'Incomplete' },
  { reimbursableMinor: 230400, disallowedMinor: 0, note: ' ' },
  { reimbursableMinor: 230400.5, disallowedMinor: 0, note: 'Fraction' },
  { reimbursableMinor: 230401, disallowedMinor: -1, note: 'Negative' },
])
  test(`invalid manual tax allocation: ${allocation.note.trim() || 'missing note'}`, () => {
    assert.throws(
      () =>
        evaluateClaimPolicy(
          input([hotelTax({ hotelTaxResolution: allocation })]),
        ),
      RangeError,
    );
  });

test('canonical in-room dining is within the daily meal cap while dinner remains separate', () => {
  const result = evaluateClaimPolicy(canonicalInput());
  const dining = result.expenseResults.find(
    (item) => item.expenseKey === 'expense-hotel-dining',
  )!;
  assert.equal(dining.knownEligibleMinor, 112000);
  assert.equal(dining.knownDisallowedMinor, 0);
  assert.equal(
    result.expenseResults.find((item) => item.expenseKey === 'expense-dinner')!
      .unresolvedMinor,
    225500,
  );
});

test('daily meal cap aggregates bills and allocation is stable under reordered input', () => {
  const bills = [
    meal({ key: 'a', amountMinor: 90000 }),
    meal({ key: 'b', amountMinor: 80000 }),
  ];
  const result = evaluateClaimPolicy(input(bills));
  assert.equal(result.knownEligibleMinor, 150000);
  assert.equal(result.knownDisallowedMinor, 20000);
  assert.ok(hasCode(result, 'MEAL_DAILY_LIMIT_EXCEEDED'));
  assert.deepEqual(
    result.expenseResults,
    evaluateClaimPolicy(input([...bills].reverse())).expenseResults.reverse(),
  );
});

test('arrival and return count as separate full meal days; absent days generate no allowance', () => {
  const result = evaluateClaimPolicy(
    input([
      meal({ key: 'a', expenseDate: '2026-06-16', amountMinor: 150000 }),
      meal({ key: 'b', expenseDate: '2026-06-20', amountMinor: 150000 }),
    ]),
  );
  assert.equal(result.knownEligibleMinor, 300000);
  assert.equal(result.expenseResults.length, 2);
});

test('Tier 2 meal cap is 100000 and inconsistent tiers on a day stay unresolved', () => {
  const result = evaluateClaimPolicy(
    input([meal({ city: 'Tier two city', cityTier: 2, amountMinor: 112000 })]),
  );
  assert.equal(result.knownEligibleMinor, 100000);
  assert.equal(result.knownDisallowedMinor, 12000);
  const ambiguous = evaluateClaimPolicy(
    input([
      meal({ key: 'a' }),
      meal({ key: 'b', city: 'Other city', cityTier: 2 }),
    ]),
  );
  assert.equal(ambiguous.knownEligibleMinor, 0);
  assert.ok(hasCode(ambiguous, 'MEAL_DATE_OR_TIER_UNRESOLVED'));
});

for (const amount of [50000, 50001, 90000])
  test(`meal bill ${amount} without proof blocks under submission requirements`, () => {
    const result = evaluateClaimPolicy(
      input([meal({ amountMinor: amount, evidenceKeys: [] })]),
    );
    assert.ok(
      result.readiness.blockingIssues.some(
        (item) => item.code === 'MISSING_PROOF',
      ),
    );
    assert.equal(result.knownEligibleMinor, 0);
    assert.equal(result.unresolvedMinor, amount);
    assert.equal(result.isFinal, false);
  });

test('excluded meal does not consume allowance of included meals', () => {
  const result = evaluateClaimPolicy(
    input([
      meal({ key: 'a', amountMinor: 150000, included: false }),
      meal({ key: 'b', amountMinor: 112000 }),
    ]),
  );
  assert.equal(result.knownEligibleMinor, 112000);
  assert.equal(result.knownDisallowedMinor, 0);
  assert.equal(result.excludedMinor, 150000);
});

test('canonical dinner needs names and prior HOD approval, not an invented rejection', () => {
  const result = evaluateClaimPolicy(input([dinner()]));
  assert.ok(hasCode(result, 'BUSINESS_ENTERTAINMENT_ATTENDEE_NAMES_MISSING'));
  assert.ok(hasCode(result, 'BUSINESS_ENTERTAINMENT_HOD_APPROVAL_MISSING'));
  assert.equal(
    hasCode(result, 'BUSINESS_ENTERTAINMENT_ORGANISATIONS_MISSING'),
    false,
  );
  assert.equal(result.unresolvedMinor, 225500);
  assert.equal(result.knownDisallowedMinor, 0);
});

function compliantDinner(): PolicyExpense {
  return dinner({
    attendees: ['Guest A', 'Guest B', 'Guest C', 'Host D'].map((name) => ({
      name,
      organisation: 'Hypothetical organisation',
    })),
    entertainmentApproval: {
      level: 'HEAD_OF_DEPARTMENT',
      decision: 'APPROVED',
      approvedAt: '2026-06-17T10:00:00+05:30',
      evidenceKey: 'approval',
    },
  });
}
test('hypothetical named attendees, organisations and proven prior HOD approval allow entertainment', () => {
  const result = evaluateClaimPolicy(input([compliantDinner()]));
  assert.equal(result.knownEligibleMinor, 225500);
  assert.equal(result.unresolvedMinor, 0);
  assert.equal(result.isFinal, true);
});

test('covers, individual organisations, approval timing and evidence are independently required', () => {
  const valid = compliantDinner();
  for (const changed of [
    { ...valid, covers: 5 },
    { ...valid, attendees: [{ name: 'Guest A', organisation: '' }] },
    {
      ...valid,
      entertainmentApproval: {
        ...valid.entertainmentApproval!,
        approvedAt: '2026-06-19T10:00:00+05:30',
      },
    },
    {
      ...valid,
      entertainmentApproval: {
        ...valid.entertainmentApproval!,
        evidenceKey: 'nonexistent',
      },
    },
    {
      ...valid,
      entertainmentApproval: {
        ...valid.entertainmentApproval!,
        level: 'REPORTING_MANAGER' as const,
      },
    },
    {
      ...valid,
      entertainmentApproval: {
        ...valid.entertainmentApproval!,
        decision: 'RETURNED' as const,
      },
    },
  ])
    assert.equal(evaluateClaimPolicy(input([changed])).unresolvedMinor, 225500);
});

test('entertainment HOD threshold is strictly above 200000', () => {
  const valid = compliantDinner();
  delete valid.entertainmentApproval;
  assert.equal(
    evaluateClaimPolicy(input([{ ...valid, amountMinor: 200000 }]))
      .knownEligibleMinor,
    200000,
  );
  assert.equal(
    evaluateClaimPolicy(input([{ ...valid, amountMinor: 200001 }]))
      .unresolvedMinor,
    200001,
  );
});

test('excluded unresolved dinner keeps informational findings and no financial contribution', () => {
  const result = evaluateClaimPolicy(
    input([expense(), dinner({ key: 'dinner', included: false })]),
  );
  const excluded = result.expenseResults.find(
    (item) => item.expenseKey === 'dinner',
  )!;
  assert.equal(excluded.knownEligibleMinor, 0);
  assert.equal(excluded.unresolvedMinor, 0);
  assert.equal(excluded.excludedMinor, 225500);
  assert.ok(
    excluded.findings.every(
      (item) => item.severity === 'INFO' && !item.blocking,
    ),
  );
  assert.equal(result.readiness.isReadyToSubmit, true);
});

test('hypothetical future review gives a final result without concealing historical gaps', () => {
  const source = canonicalInput();
  source.expenses = source.expenses.map((item) =>
    item.key === 'expense-dinner'
      ? { ...item, included: false }
      : item.key === 'expense-hotel-mixed-tax'
        ? {
            ...item,
            hotelTaxResolution: {
              reimbursableMinor: 200000,
              disallowedMinor: 30400,
              note: 'Hypothetical complete review, not canonical data',
            },
          }
        : item,
  );
  const result = evaluateClaimPolicy(source);
  assert.equal(result.knownEligibleMinor, 2392904);
  assert.equal(result.knownDisallowedMinor, 113400);
  assert.equal(result.excludedMinor, 225500);
  assert.equal(result.unresolvedMinor, 0);
  assert.equal(result.payableMinor, 392904);
  assert.equal(result.recoverableMinor, 0);
  assert.equal(result.isFinal, true);
  assert.equal(result.readiness.isReadyToSubmit, true);
  assert.deepEqual(result.requiredClaimApprovalLevels, ['REPORTING_MANAGER']);
  assert.deepEqual(result.requiredPreTravelApprovalLevels, [
    'REPORTING_MANAGER',
    'HEAD_OF_DEPARTMENT',
  ]);
  for (const code of [
    'MISSING_TRAVEL_REQUEST_ID',
    'MISSING_PRETRAVEL_HOD_APPROVAL',
  ]) {
    assert.ok(
      result.readiness.warnings.some(
        (item) =>
          item.code === code &&
          item.historicalException &&
          !item.userActionRequired,
      ),
    );
  }
});
test('ownership mismatch contributes no reimbursement and remains visible', () => {
  const result = evaluateClaimPolicy(
    input([expense({ employeeKey: 'another-employee' })]),
  );
  assert.equal(result.knownEligibleMinor, 0);
  assert.equal(result.knownDisallowedMinor, 17200);
  assert.ok(
    result.readiness.blockingIssues.some(
      (item) => item.code === 'CLAIMANT_MISMATCH',
    ),
  );
});

test('vague labels, unknown references and unsuitable evidence do not satisfy proof', () => {
  for (const classification of [
    'SUPPORTING_TRIP',
    'APPROVAL',
    'ADVANCE',
    'NOISE',
    'CLAIMANT_MISMATCH',
  ] as const) {
    const candidate = input();
    candidate.evidence = [{ key: 'receipt', classification }];
    assert.ok(hasCode(evaluateClaimPolicy(candidate), 'MISSING_PROOF'));
  }
  for (const keys of [[], ['attached receipt'], ['unknown-id']])
    assert.ok(
      hasCode(
        evaluateClaimPolicy(input([expense({ evidenceKeys: keys })])),
        'MISSING_PROOF',
      ),
    );
});

test('company-paid expenses stay visible and can receive proof findings without employee contributions', () => {
  const result = evaluateClaimPolicy(
    input([
      expense(),
      expense({
        key: 'company',
        paidBy: 'COMPANY',
        category: 'AIR_TRAVEL',
        componentType: 'FLIGHT_SECTOR',
        amountMinor: 501600,
        evidenceKeys: [],
      }),
    ]),
  );
  assert.equal(result.companyPaidGrossMinor, 501600);
  assert.equal(result.knownEligibleMinor, 17200);
  assert.equal(result.unresolvedMinor, 0);
  assert.ok(
    result.readiness.blockingIssues.some(
      (item) => item.code === 'MISSING_PROOF' && item.expenseKey === 'company',
    ),
  );
});

test('employee-paid domestic flight is not reimbursed as a personal claim', () => {
  const result = evaluateClaimPolicy(
    input([
      expense({
        category: 'AIR_TRAVEL',
        componentType: 'FLIGHT_SECTOR',
        amountMinor: 501600,
      }),
    ]),
  );
  assert.equal(result.knownEligibleMinor, 0);
  assert.equal(result.knownDisallowedMinor, 501600);
  assert.ok(hasCode(result, 'AIR_TRAVEL_NOT_EMPLOYEE_CLAIM'));
});

test('strong bill identity detects duplicates independently of input order without double deduction', () => {
  const original = expense({ key: 'a', billReference: 'CAB-17' });
  const repeat = expense({
    key: 'b',
    billReference: ' cab-17 ',
    merchant: ' CAB   MERCHANT ',
  });
  const result = evaluateClaimPolicy(input([repeat, original]));
  assert.equal(result.knownEligibleMinor, 17200);
  assert.equal(result.knownDisallowedMinor, 0);
  assert.equal(result.excludedMinor, 17200);
  assert.equal(
    result.expenseResults.find((item) => item.expenseKey === 'b')!.status,
    'DUPLICATE',
  );
  assert.ok(
    result.readiness.blockingIssues.some(
      (item) => item.code === 'DUPLICATE_EXPENSE',
    ),
  );
  assert.deepEqual(
    detectDuplicates([repeat, original], []),
    detectDuplicates([original, repeat], []),
  );
  const reviewed = evaluateClaimPolicy(
    input([original, { ...repeat, included: false }]),
  );
  assert.equal(reviewed.knownEligibleMinor, 17200);
  assert.equal(reviewed.readiness.isReadyToSubmit, true);
});

test('same amount alone, different merchant, different amount or distinct bill lines are not duplicates', () => {
  const original = expense({ key: 'a', billReference: 'CAB-17' });
  for (const other of [
    expense({ key: 'b' }),
    expense({
      key: 'b',
      billReference: 'CAB-17',
      merchant: 'Different merchant',
    }),
    expense({ key: 'b', billReference: 'CAB-17', amountMinor: 18000 }),
    expense({
      key: 'b',
      billReference: 'CAB-17',
      lineReference: 'separate line',
    }),
    expense({ key: 'b', billReference: 'OTHER-17' }),
  ])
    assert.equal(detectDuplicates([original, other], []).size, 0);
  assert.equal(
    detectDuplicates(canonicalInput().expenses, canonicalInput().evidence).size,
    0,
  );
});

test('explicit duplicate email 10 maps to original 09 without creating a second reimbursement', () => {
  const source = canonicalInput();
  const original = source.expenses.find(
    (item) => item.key === 'expense-uber-03',
  )!;
  source.expenses = [
    ...source.expenses,
    {
      ...original,
      key: 'extra-duplicate',
      evidenceKeys: ['evidence-email-10'],
    },
  ];
  const result = evaluateClaimPolicy(source);
  assert.equal(result.knownEligibleMinor, 2192904);
  assert.equal(result.excludedMinor, 17200);
  assert.equal(
    result.expenseResults.find((item) => item.expenseKey === 'extra-duplicate')!
      .status,
    'DUPLICATE',
  );
});

test('canonical failed payment and duplicate evidence add context, not financial lines', () => {
  const result = evaluateClaimPolicy(canonicalInput());
  assert.equal(result.expenseResults.length, 14);
  assert.equal(result.knownDisallowedMinor, 83000);
  assert.equal(result.excludedMinor, 0);
  assert.ok(
    result.readiness.informational.some(
      (item) =>
        item.code === 'FAILED_PAYMENT_EVIDENCE' &&
        item.evidenceKeys?.includes('evidence-email-08'),
    ),
  );
  assert.ok(
    result.readiness.informational.some(
      (item) =>
        item.code === 'DUPLICATE_EXPENSE' &&
        item.evidenceKeys?.includes('evidence-email-10'),
    ),
  );
});

test('a hypothetical failed-only candidate cannot become paid or disallowed spend', () => {
  const source = input([expense({ evidenceKeys: ['failure'] })]);
  source.evidence = [
    ...source.evidence,
    { key: 'failure', classification: 'PAYMENT_FAILURE' },
  ];
  const result = evaluateClaimPolicy(source);
  assert.equal(result.knownEligibleMinor, 0);
  assert.equal(result.knownDisallowedMinor, 0);
  assert.equal(result.expenseResults[0]!.status, 'NOT_PAID');
  assert.equal(result.isFinal, false);
});

const levels: ApprovalLevel[] = [
  'REPORTING_MANAGER',
  'HEAD_OF_DEPARTMENT',
  'HEAD_OF_DIVISION',
  'MANAGING_DIRECTOR',
];
for (const [amount, count] of [
  [2500000, 1],
  [2500001, 2],
  [2500100, 2],
  [7500000, 2],
  [7500001, 3],
  [7500100, 3],
  [20000000, 3],
  [20000001, 4],
  [20000100, 4],
] as const)
  test(`approval boundary convention: ${amount} minor units requires ${count} levels`, () => {
    assert.deepEqual(
      requiredApprovalLevels(amount, 'DOMESTIC'),
      levels.slice(0, count),
    );
  });

test('international travel requires the full business hierarchy, with Finance separate', () => {
  assert.deepEqual(requiredApprovalLevels(100, 'INTERNATIONAL'), levels);
  const result = evaluateClaimPolicy(input());
  assert.equal(result.financeVerificationRequired, true);
  assert.equal(
    result.requiredClaimApprovalLevels.includes('FINANCE' as ApprovalLevel),
    false,
  );
});

test('canonical pre-travel estimate needs RM and HOD; only evidenced RM is proven', () => {
  const result = evaluateClaimPolicy(canonicalInput());
  assert.deepEqual(result.requiredPreTravelApprovalLevels, [
    'REPORTING_MANAGER',
    'HEAD_OF_DEPARTMENT',
  ]);
  assert.ok(hasCode(result, 'MISSING_PRETRAVEL_HOD_APPROVAL'));
  assert.equal(hasCode(result, 'MISSING_PRETRAVEL_APPROVAL'), false);
  assert.equal(result.claimedValueMinor, 2648804);
  assert.equal(result.claimApprovalBasisIsProvisional, true);
});

test('pre-travel approval without proof or after booking does not satisfy history', () => {
  for (const change of [
    { evidenceKey: 'absent' },
    { approvedAt: '2026-06-18T12:00:00+05:30' },
  ]) {
    const source = input();
    source.travel.preTravelApprovals = source.travel.preTravelApprovals.map(
      (item) => ({ ...item, ...change }),
    );
    assert.ok(
      hasCode(evaluateClaimPolicy(source), 'MISSING_PRETRAVEL_APPROVAL'),
    );
  }
});

test('advance cap cannot use the overall trip estimate as the employee-borne denominator', () => {
  const result = evaluateClaimPolicy(canonicalInput());
  assert.equal(result.advanceCap.status, 'UNDETERMINED');
  assert.equal(result.advanceCap.capMinor, null);
  assert.equal(assessAdvanceCap(2000000, 4000000).status, 'PASS');
  assert.equal(assessAdvanceCap(2000000, 4000000).capMinor, 2400000);
  assert.equal(assessAdvanceCap(2400001, 4000000).status, 'FAIL');
  assert.equal(assessAdvanceCap(2, 3).capMinor, 1);
});

for (const [eligible, payable, recoverable] of [
  [2500000, 500000, 0],
  [1500000, 0, 500000],
  [2000000, 0, 0],
] as const) {
  test(`advance settlement for ${eligible} eligible is mutually exclusive payable/recoverable`, () => {
    assert.deepEqual(adjustAdvance(eligible, 2000000), {
      payableMinor: payable,
      recoverableMinor: recoverable,
    });
    assert.deepEqual(calculateSettlement(eligible, 2000000, 0), {
      isFinal: true,
      payableMinor: payable,
      recoverableMinor: recoverable,
    });
  });
}

test('unresolved amounts or other blockers never produce fake zero final settlement', () => {
  for (const [unresolved, blocked] of [
    [230400, false],
    [0, true],
  ] as const) {
    assert.deepEqual(
      calculateSettlement(2000000, 2000000, unresolved, blocked),
      { isFinal: false, payableMinor: null, recoverableMinor: null },
    );
  }
});

test('empty claim is not ready even if arithmetic has no unresolved amount', () => {
  assert.equal(evaluateClaimPolicy(input([])).readiness.isReadyToSubmit, false);
});

test('invalid money, overflowing sums, repeated keys and invalid business dates fail safely', () => {
  for (const amount of [
    -1,
    0.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => evaluateClaimPolicy(input([expense({ amountMinor: amount })])),
      RangeError,
    );
  }
  assert.throws(() => sumMinor([Number.MAX_SAFE_INTEGER, 1]), RangeError);
  assert.throws(
    () => evaluateClaimPolicy(input([expense(), expense()])),
    TypeError,
  );
  const invalid = input();
  invalid.travel.startDate = '2026-02-30';
  assert.throws(() => evaluateClaimPolicy(invalid), TypeError);
  const expenseDate = evaluateClaimPolicy(
    input([expense({ expenseDate: '2026-02-30' })]),
  );
  assert.equal(expenseDate.knownEligibleMinor, 0);
  assert.equal(expenseDate.isFinal, false);
  assert.throws(
    () =>
      evaluateClaimPolicy(
        input([expense({ occurredAt: '2026-06-18T12:00:00' })]),
      ),
    RangeError,
  );
});
test('category/component mismatches and invalid timestamp dates cannot bypass rules', () => {
  assert.throws(
    () =>
      evaluateClaimPolicy(
        input([expense({ category: 'MEAL', componentType: 'ROOM' })]),
      ),
    TypeError,
  );
  assert.throws(
    () =>
      evaluateClaimPolicy(
        input([expense({ occurredAt: '2026-02-30T12:00:00+05:30' })]),
      ),
    RangeError,
  );
});

test('the workbook example is not accepted as an actual Travel Request ID', () => {
  const source = input();
  source.travel.travelRequestId = 'TRQ-2026-0000';
  const result = evaluateClaimPolicy(source);
  assert.ok(
    result.readiness.warnings.some(
      (item) =>
        item.code === 'MISSING_TRAVEL_REQUEST_ID' && item.historicalException,
    ),
  );
});

test('missing proof blocks submission without turning a known laundry exclusion into unknown money', () => {
  const result = evaluateClaimPolicy(
    input([
      expense({
        category: 'OTHER',
        componentType: 'LAUNDRY',
        amountMinor: 45000,
        evidenceKeys: [],
      }),
    ]),
  );
  assert.equal(result.knownDisallowedMinor, 45000);
  assert.equal(result.unresolvedMinor, 0);
  assert.equal(result.isFinal, false);
  assert.ok(
    result.readiness.blockingIssues.some(
      (item) => item.code === 'MISSING_PROOF',
    ),
  );
});
