import { assessAdvanceCap } from './advance.js';
import {
  evaluatePreTravelApprovals,
  requiredApprovalLevels,
} from './approvals.js';
import { detectDuplicates } from './duplicates.js';
import { evaluateEntertainment } from './entertainment.js';
import { finding, informational } from './findings.js';
import { cityTier, evaluateLodging } from './lodging.js';
import { evaluateMeals } from './meals.js';
import { assertMinor, isBusinessDate, sumMinor, timestamp } from './money.js';
import { validateOwnership } from './ownership.js';
import { hasProof, validateProof } from './proof.js';
import { evaluateReadiness } from './readiness.js';
import { calculateSettlement } from './settlement.js';
import type {
  AmountEvaluation,
  ExpenseEvaluation,
  PolicyExpense,
  PolicyFinding,
  PolicyInput,
} from './types.js';

const componentCategories: Record<
  PolicyExpense['componentType'],
  PolicyExpense['category']
> = {
  FLIGHT_SECTOR: 'AIR_TRAVEL',
  ROOM: 'LODGING',
  RIDE: 'LOCAL_CONVEYANCE',
  IN_ROOM_DINING: 'MEAL',
  DINNER: 'BUSINESS_ENTERTAINMENT',
  LAUNDRY: 'OTHER',
  MINIBAR: 'OTHER',
  HOTEL_MIXED_TAX: 'OTHER',
};

function validateInput(input: PolicyInput): void {
  const travel = input.travel;
  if (
    !input.claimantKey.trim() ||
    !travel.destination.trim() ||
    !isBusinessDate(travel.startDate) ||
    !isBusinessDate(travel.endDate) ||
    travel.startDate > travel.endDate ||
    (travel.bookingDate !== undefined && !isBusinessDate(travel.bookingDate))
  )
    throw new TypeError('Invalid claimant or travel dates/destination');
  assertMinor(travel.estimatedSpendMinor);
  assertMinor(travel.advanceMinor);
  for (const list of [input.expenses, input.evidence]) {
    if (
      list.some((item) => !item.key.trim()) ||
      new Set(list.map((item) => item.key)).size !== list.length
    )
      throw new TypeError('Keys must be nonempty and unique');
  }
  for (const expense of input.expenses) {
    assertMinor(expense.amountMinor);
    if (
      !expense.employeeKey.trim() ||
      !expense.merchant.trim() ||
      expense.currency !== 'INR' ||
      !['EMPLOYEE', 'COMPANY'].includes(expense.paidBy)
    )
      throw new TypeError('Invalid expense identity, currency or paidBy');
    if (
      ![
        'AIR_TRAVEL',
        'LODGING',
        'LOCAL_CONVEYANCE',
        'MEAL',
        'BUSINESS_ENTERTAINMENT',
        'OTHER',
      ].includes(expense.category) ||
      ![
        'FLIGHT_SECTOR',
        'ROOM',
        'RIDE',
        'IN_ROOM_DINING',
        'DINNER',
        'LAUNDRY',
        'MINIBAR',
        'HOTEL_MIXED_TAX',
      ].includes(expense.componentType)
    )
      throw new TypeError('Unsupported expense category/component');
    if (componentCategories[expense.componentType] !== expense.category)
      throw new TypeError('Expense category and component disagree');
    if (expense.occurredAt) timestamp(expense.occurredAt);
    if (
      expense.covers !== undefined &&
      (!Number.isSafeInteger(expense.covers) || expense.covers <= 0)
    )
      throw new RangeError('Covers must be a positive integer');
    cityTier(
      expense.city ?? travel.destination,
      expense.cityTier ?? travel.cityTier,
    );
  }
}

function evaluateAmount(
  expense: PolicyExpense,
  input: PolicyInput,
  meals: Map<string, AmountEvaluation>,
): AmountEvaluation {
  if (expense.category === 'BUSINESS_ENTERTAINMENT')
    return evaluateEntertainment(expense, input.evidence);
  if (
    ['ROOM', 'LAUNDRY', 'MINIBAR', 'HOTEL_MIXED_TAX'].includes(
      expense.componentType,
    )
  ) {
    return evaluateLodging(
      expense,
      cityTier(
        expense.city ?? input.travel.destination,
        expense.cityTier ?? input.travel.cityTier,
      ),
    );
  }
  if (expense.category === 'MEAL')
    return (
      meals.get(expense.key) ??
      evaluateMeals([expense], input.travel).get(expense.key)!
    );
  if (
    expense.category === 'LOCAL_CONVEYANCE' ||
    (expense.category === 'AIR_TRAVEL' && expense.paidBy === 'COMPANY')
  ) {
    return {
      knownEligibleMinor: expense.amountMinor,
      knownDisallowedMinor: 0,
      unresolvedMinor: 0,
      findings: [],
    };
  }
  if (
    expense.category === 'AIR_TRAVEL' &&
    input.travel.travelType === 'DOMESTIC'
  )
    return {
      knownEligibleMinor: 0,
      knownDisallowedMinor: expense.amountMinor,
      unresolvedMinor: 0,
      findings: [
        finding(
          'AIR_TRAVEL_NOT_EMPLOYEE_CLAIM',
          'WARNING',
          'Domestic flights are centrally billed to the company and are not employee claims.',
          '§3.2',
          { expenseKey: expense.key },
        ),
      ],
    };
  return {
    knownEligibleMinor: 0,
    knownDisallowedMinor: 0,
    unresolvedMinor: expense.amountMinor,
    findings: [
      finding(
        'POLICY_REVIEW_REQUIRED',
        'BLOCKING',
        'This expense does not have a deterministically supported entitlement.',
        '§3 / §4',
        { expenseKey: expense.key },
      ),
    ],
  };
}

function evaluateExpense(
  expense: PolicyExpense,
  input: PolicyInput,
  meals: Map<string, AmountEvaluation>,
  duplicateOf: string | undefined,
): ExpenseEvaluation {
  const companyPaid = expense.paidBy === 'COMPANY';
  const context = {
    expenseKey: expense.key,
    evidenceKeys: expense.evidenceKeys,
  };
  let amount = evaluateAmount(expense, input, meals);
  const ownership = validateOwnership(expense, input.claimantKey);
  const proof = validateProof(expense, input.evidence);
  const findings = [...amount.findings, ...ownership, ...proof];
  if (
    expense.componentType !== 'HOTEL_MIXED_TAX' &&
    (!isBusinessDate(expense.expenseDate) ||
      expense.expenseDate < input.travel.startDate ||
      expense.expenseDate > input.travel.endDate)
  ) {
    findings.push(
      finding(
        'POLICY_REVIEW_REQUIRED',
        'BLOCKING',
        'Confirm the expense business date within the travel period.',
        '§3',
        context,
      ),
    );
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      knownDisallowedMinor: 0,
      unresolvedMinor: expense.amountMinor,
    };
  }
  if (proof.length)
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      unresolvedMinor: sumMinor([
        amount.knownEligibleMinor,
        amount.unresolvedMinor,
      ]),
    };
  if (ownership.length)
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      knownDisallowedMinor: expense.amountMinor,
      unresolvedMinor: 0,
    };
  let excludedMinor = 0;
  let status: ExpenseEvaluation['status'] = amount.unresolvedMinor
    ? 'UNRESOLVED'
    : amount.knownDisallowedMinor
      ? amount.knownEligibleMinor
        ? 'PARTIALLY_DISALLOWED'
        : 'DISALLOWED'
      : 'ELIGIBLE';
  if (duplicateOf) {
    findings.push(
      finding(
        'DUPLICATE_EXPENSE',
        'BLOCKING',
        'This candidate repeats a retained bill; exclude the duplicate line.',
        '§5.3',
        { ...context, metadata: { duplicateOf } },
      ),
    );
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      knownDisallowedMinor: 0,
      unresolvedMinor: 0,
    };
    excludedMinor = companyPaid ? 0 : expense.amountMinor;
    status = 'DUPLICATE';
  }
  const failureOnly =
    expense.evidenceKeys.length > 0 &&
    expense.evidenceKeys.every((key) =>
      input.evidence.some(
        (item) => item.key === key && item.classification === 'PAYMENT_FAILURE',
      ),
    );
  if (failureOnly) {
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      knownDisallowedMinor: 0,
      unresolvedMinor: 0,
    };
    excludedMinor = companyPaid ? 0 : expense.amountMinor;
    status = 'NOT_PAID';
  }
  if (companyPaid) {
    findings.push(
      finding(
        'COMPANY_PAID_COST',
        'INFO',
        'Company-paid cost retained for audit; employee reimbursement contribution is zero.',
        '§3.2',
        context,
      ),
    );
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      knownDisallowedMinor: 0,
      unresolvedMinor: 0,
    };
    status = 'COMPANY_PAID';
  }
  if (expense.included === false) {
    amount = {
      ...amount,
      knownEligibleMinor: 0,
      knownDisallowedMinor: 0,
      unresolvedMinor: 0,
    };
    excludedMinor = companyPaid ? 0 : expense.amountMinor;
    status = 'EXCLUDED';
    findings.push(
      finding(
        'EXCLUDED_EXPENSE',
        'INFO',
        'Explicitly excluded for this evaluation; source and findings remain visible.',
        '§5.2',
        context,
      ),
    );
  }
  return {
    expenseKey: expense.key,
    sourceAmountMinor: expense.amountMinor,
    employeePaidCandidateMinor:
      companyPaid || excludedMinor || expense.included === false
        ? 0
        : expense.amountMinor,
    companyPaidMemoMinor: companyPaid ? expense.amountMinor : 0,
    excludedMinor,
    knownEligibleMinor: amount.knownEligibleMinor,
    knownDisallowedMinor: amount.knownDisallowedMinor,
    unresolvedMinor: amount.unresolvedMinor,
    status,
    findings:
      expense.included === false ? findings.map(informational) : findings,
  };
}

export function evaluateClaimPolicy(input: PolicyInput) {
  validateInput(input);
  const included = input.expenses.filter(
    (expense) =>
      expense.included !== false && expense.employeeKey === input.claimantKey,
  );
  const duplicates = detectDuplicates(included, input.evidence);
  const meals = evaluateMeals(
    included.filter(
      (expense) =>
        expense.category === 'MEAL' &&
        expense.paidBy === 'EMPLOYEE' &&
        !duplicates.has(expense.key) &&
        hasProof(expense, input.evidence),
    ),
    input.travel,
  );
  const expenseResults = input.expenses.map((expense) =>
    evaluateExpense(expense, input, meals, duplicates.get(expense.key)),
  );
  const preTravel = evaluatePreTravelApprovals(input.travel, input.evidence);
  const advanceCap = assessAdvanceCap(
    input.travel.advanceMinor,
    input.travel.estimatedEmployeeBorneMinor,
  );
  const findings: PolicyFinding[] = [
    ...preTravel.findings,
    ...advanceCap.findings,
    ...expenseResults.flatMap((expense) => expense.findings),
  ];
  for (const evidence of input.evidence) {
    if (evidence.classification === 'PAYMENT_FAILURE')
      findings.push(
        finding(
          'FAILED_PAYMENT_EVIDENCE',
          'INFO',
          'Failed transaction retained for traceability; it is not proof of a paid expense.',
          '§3.4 / §5.2',
          { evidenceKeys: [evidence.key] },
        ),
      );
    if (evidence.classification === 'DUPLICATE')
      findings.push(
        finding(
          'DUPLICATE_EXPENSE',
          'INFO',
          'Duplicate evidence retained for traceability; it does not create another claim line.',
          '§5.3',
          { evidenceKeys: [evidence.key] },
        ),
      );
  }
  if (!expenseResults.some((expense) => expense.employeePaidCandidateMinor > 0))
    findings.push(
      finding(
        'EMPTY_CLAIM',
        'BLOCKING',
        'There are no included employee-paid claim candidates.',
        '§5',
        {},
      ),
    );
  const employeePaidGrossMinor = sumMinor(
    input.expenses
      .filter((expense) => expense.paidBy === 'EMPLOYEE')
      .map((expense) => expense.amountMinor),
  );
  const companyPaidGrossMinor = sumMinor(
    expenseResults.map((expense) => expense.companyPaidMemoMinor),
  );
  const knownEligibleMinor = sumMinor(
    expenseResults.map((expense) => expense.knownEligibleMinor),
  );
  const knownDisallowedMinor = sumMinor(
    expenseResults.map((expense) => expense.knownDisallowedMinor),
  );
  const unresolvedMinor = sumMinor(
    expenseResults.map((expense) => expense.unresolvedMinor),
  );
  const excludedMinor = sumMinor(
    expenseResults.map((expense) => expense.excludedMinor),
  );
  if (
    sumMinor([
      knownEligibleMinor,
      knownDisallowedMinor,
      unresolvedMinor,
      excludedMinor,
    ]) !== employeePaidGrossMinor
  )
    throw new Error('Expense accounting invariant failed');
  const settlement = calculateSettlement(
    knownEligibleMinor,
    input.travel.advanceMinor,
    unresolvedMinor,
    findings.some((item) => item.blocking),
  );
  // Current claim basis includes unresolved requested amounts, but excludes known disallowances and company memo costs.
  const claimedValueMinor = sumMinor([knownEligibleMinor, unresolvedMinor]);
  return {
    expenseResults,
    findings,
    employeePaidGrossMinor,
    companyPaidGrossMinor,
    knownEligibleMinor,
    knownDisallowedMinor,
    unresolvedMinor,
    excludedMinor,
    advanceMinor: input.travel.advanceMinor,
    ...settlement,
    claimedValueMinor,
    claimApprovalBasisIsProvisional: !settlement.isFinal,
    requiredClaimApprovalLevels: requiredApprovalLevels(
      claimedValueMinor,
      input.travel.travelType,
    ),
    requiredPreTravelApprovalLevels: preTravel.requiredLevels,
    financeVerificationRequired: true,
    advanceCap,
    readiness: evaluateReadiness(findings, settlement.isFinal),
  };
}
