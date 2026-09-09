import assert from 'node:assert/strict';
import { Employee } from '../../modules/employees/employee.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Claim } from '../../modules/claims/claim.model.js';
import {
  SOURCE_DATASET,
  TRAVEL_KEY,
  CLAIM_KEY,
  canonicalEmails,
  canonicalExpenses,
  canonicalRelationships,
  sourceHashes,
} from './canonicalData.js';

export async function verifySeed() {
  const filter = { sourceDataset: SOURCE_DATASET };
  const [employees, travels, evidence, expenses, claims] = await Promise.all([
    Employee.find(filter).lean(),
    TravelRequest.find(filter).lean(),
    Evidence.find(filter).lean(),
    Expense.find(filter).lean(),
    Claim.find(filter).lean(),
  ]);
  assert.deepEqual(
    [
      employees.length,
      travels.length,
      evidence.length,
      expenses.length,
      claims.length,
    ],
    [9, 1, 17, 14, 1],
    'Seeded document counts',
  );
  const employeeByCode = new Map(
    employees.map((item) => [item.employeeCode, item]),
  );
  const hierarchy = ['NX-4471', 'NX-2210', 'NX-1108', 'NX-1002', 'NX-1000'];
  for (let index = 0; index < hierarchy.length; index++) {
    const employee = employeeByCode.get(hierarchy[index]!);
    assert.ok(employee);
    const managerCode = hierarchy[index + 1];
    assert.equal(
      employee.reportingManager?.toString() ?? null,
      managerCode ? employeeByCode.get(managerCode)?._id.toString() : null,
    );
  }
  const claimant = employeeByCode.get('NX-4471');
  const manager = employeeByCode.get('NX-2210');
  assert.ok(claimant && manager);
  const travel = travels[0];
  assert.ok(travel);
  assert.equal(travel.seedKey, TRAVEL_KEY);
  assert.equal(travel.employee.toString(), claimant._id.toString());
  assert.equal(travel.travelRequestId, null);
  assert.deepEqual(
    [
      travel.estimatedSpendMinor,
      travel.advanceRequestedMinor,
      travel.advanceDisbursedMinor,
      travel.plannedLodgingNights,
      travel.evidencedLodgingNights,
    ],
    [4800000, 2000000, 2000000, 4, 3],
  );
  assert.deepEqual(
    [travel.startDate, travel.endDate, travel.advanceReference],
    ['2026-06-16', '2026-06-20', 'ADV/2026/0619'],
  );
  const evidenceByKey = new Map(evidence.map((item) => [item.seedKey, item]));
  assert.equal(evidence.filter((item) => item.kind === 'EMAIL').length, 15);
  assert.equal(evidence.filter((item) => item.kind === 'IMAGE').length, 2);
  for (const item of evidence) {
    assert.equal(item.travelRequest.toString(), travel._id.toString());
    assert.equal(item.contentHashSha256, sourceHashes[item.sourceRelativePath]);
  }
  for (const expected of canonicalEmails) {
    const actual = evidenceByKey.get(expected.seedKey);
    assert.equal(actual?.messageId, expected.messageId);
    assert.equal(actual?.classification, expected.classification);
  }
  assert.equal(travel.preTravelApprovals.length, 1);
  const approval = travel.preTravelApprovals[0];
  assert.ok(approval);
  assert.equal(approval.approver.toString(), manager._id.toString());
  assert.equal(approval.role, 'REPORTING_MANAGER');
  assert.equal(approval.decision, 'APPROVED');
  assert.equal(
    approval.approvedAt.toISOString(),
    new Date('2026-06-08T18:40:55+05:30').toISOString(),
  );
  assert.equal(
    approval.evidence.toString(),
    evidenceByKey.get('evidence-email-02')?._id.toString(),
  );
  assert.equal(travel.advanceEvidence.length, 1);
  assert.equal(
    travel.advanceEvidence[0]?.toString(),
    evidenceByKey.get('evidence-email-03')?._id.toString(),
  );
  for (const relation of canonicalRelationships) {
    assert.ok(
      evidenceByKey
        .get(relation.from)
        ?.relationships.some(
          (item) =>
            item.type === relation.type &&
            item.evidence.toString() ===
              evidenceByKey.get(relation.to)?._id.toString(),
        ),
    );
  }
  assert.equal(
    evidence.reduce((sum, item) => sum + item.relationships.length, 0),
    canonicalRelationships.length,
  );
  for (const [image, email] of [
    ['evidence-image-dinner', 'evidence-email-11'],
    ['evidence-image-hotel', 'evidence-email-12'],
  ] as const) {
    assert.equal(
      evidenceByKey.get(image)?.parentEvidence?.toString(),
      evidenceByKey.get(email)?._id.toString(),
    );
  }
  for (const expected of canonicalExpenses) {
    const expense = expenses.find((item) => item.seedKey === expected.seedKey);
    assert.ok(expense);
    assert.equal(expense.amountMinor, expected.amountMinor);
    assert.equal(expense.currency, 'INR');
    assert.ok(Number.isSafeInteger(expense.amountMinor));
    assert.equal(expense.paidBy, expected.paidBy);
    assert.equal(expense.category, expected.category);
    assert.equal(expense.componentType, expected.componentType);
    assert.equal(expense.expenseDate, expected.expenseDate);
    assert.equal(expense.sourceReviewState, expected.sourceReviewState);
    assert.equal(expense.employee.toString(), claimant._id.toString());
    assert.equal(expense.travelRequest.toString(), travel._id.toString());
    assert.deepEqual(
      expense.sourceEvidence.map((id) => id.toString()).sort(),
      expected.evidenceKeys
        .map((key) => evidenceByKey.get(key)?._id.toString())
        .sort(),
    );
  }
  const sum = (items: typeof expenses) =>
    items.reduce((total, item) => total + item.amountMinor, 0);
  const totalsMinor = {
    uber: sum(expenses.filter((item) => item.category === 'LOCAL_CONVEYANCE')),
    flights: sum(expenses.filter((item) => item.category === 'AIR_TRAVEL')),
    hotel: sum(
      expenses.filter((item) => item.seedKey.startsWith('expense-hotel-')),
    ),
    employeePaidRawGross: sum(
      expenses.filter((item) => item.paidBy === 'EMPLOYEE'),
    ),
    companyPaidRawGross: sum(
      expenses.filter((item) => item.paidBy === 'COMPANY'),
    ),
  };
  assert.deepEqual(totalsMinor, {
    uber: 355904,
    flights: 1055600,
    hotel: 2150400,
    employeePaidRawGross: 2731804,
    companyPaidRawGross: 1055600,
  });
  const claim = claims[0];
  assert.ok(claim);
  assert.equal(claim.seedKey, CLAIM_KEY);
  assert.equal(claim.status, 'DRAFT');
  assert.equal(claim.approvals.length, 0);
  assert.equal(claim.employee.toString(), claimant._id.toString());
  assert.equal(claim.travelRequest.toString(), travel._id.toString());
  assert.deepEqual(
    claim.expenses.map((id) => id.toString()).sort(),
    expenses.map((item) => item._id.toString()).sort(),
  );
  assert.ok(
    !('finance' in claim) &&
      !('settlement' in claim) &&
      !('payableMinor' in claim) &&
      !('recoverableMinor' in claim),
  );
  return {
    counts: {
      employees: employees.length,
      travelRequests: travels.length,
      evidence: evidence.length,
      expenses: expenses.length,
      claims: claims.length,
    },
    totalsMinor,
    identities: {
      employees: Object.fromEntries(
        employees.map((item) => [item.employeeCode, item._id.toString()]),
      ),
      travelRequests: Object.fromEntries(
        travels.map((item) => [item.seedKey, item._id.toString()]),
      ),
      evidence: Object.fromEntries(
        evidence.map((item) => [item.seedKey, item._id.toString()]),
      ),
      expenses: Object.fromEntries(
        expenses.map((item) => [item.seedKey, item._id.toString()]),
      ),
      claims: Object.fromEntries(
        claims.map((item) => [item.seedKey, item._id.toString()]),
      ),
    },
  };
}
