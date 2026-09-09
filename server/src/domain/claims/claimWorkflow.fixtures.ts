import { Types } from 'mongoose';
import { Claim } from '../../modules/claims/claim.model.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import {
  canonicalEmails,
  canonicalExpenses,
  canonicalImages,
  canonicalRelationships,
} from '../../seed/assignmentPack/canonicalData.js';
import { evaluateClaimPolicy } from '../policy/evaluateClaim.js';
import type { PolicyInput } from '../policy/types.js';
import {
  assembleClaimPolicyInput,
  policyInputHash,
  workflowClaim,
} from './claimPolicyContext.js';
import { employeeActor } from './identity.js';
import type { Actor, WorkflowContext, WorkflowPlan } from './types.js';

const objectId = (value: number) =>
  new Types.ObjectId(value.toString(16).padStart(24, '0'));
const people: [string, string, Actor['organizationalRole'], number | null][] = [
  ['NX-4471', 'Chaitanya Reddy', 'EMPLOYEE', 2],
  ['NX-2210', 'Suresh Iyer', 'REPORTING_MANAGER', 3],
  ['NX-1108', 'Meera Krishnan', 'HEAD_OF_DEPARTMENT', 4],
  ['NX-1002', 'Arvind Rao', 'HEAD_OF_DIVISION', 5],
  ['NX-1000', 'Nandita Shah', 'MANAGING_DIRECTOR', null],
  ['NX-3305', 'Ravi Menon', 'FINANCE', 7],
  ['NX-3300', 'Kavitha Balan', 'FINANCE', 4],
  ['NX-5182', 'Deepa Nair', 'EMPLOYEE', 2],
  ['NX-4490', 'Imran Qureshi', 'EMPLOYEE', 2],
];
export const employees = people.map(
  ([employeeCode, name, organizationalRole, manager], index) =>
    new Employee({
      _id: objectId(index + 1),
      employeeCode,
      name,
      organizationalRole,
      reportingManager: manager ? objectId(manager) : null,
      designation: 'Offline fixture',
      department: 'Fixture department',
      costCentre: 'Fixture cost centre',
      city: 'Pune',
      sourceDataset: 'test',
    }).toObject(),
);
export const actors = employees.map(employeeActor);
export const claimant = actors[0]!;
export const suresh = actors[1]!;
export const meera = actors[2]!;
export const arvind = actors[3]!;
export const nandita = actors[4]!;
export const ravi = actors[5]!;
export const kavitha = actors[6]!;
export const deepa = actors[7]!;
export const actionTime = new Date('2026-06-21T10:00:00Z');

export function canonicalDocuments() {
  const travelId = objectId(100);
  const evidenceIds = new Map(
    [...canonicalEmails, ...canonicalImages].map((item, index) => [
      item.seedKey,
      objectId(200 + index),
    ]),
  );
  const evidence = [
    ...canonicalEmails.map((item) =>
      new Evidence({
        _id: evidenceIds.get(item.seedKey),
        seedKey: item.seedKey,
        sourceDataset: 'test',
        travelRequest: travelId,
        kind: 'EMAIL',
        classification: item.classification,
        messageId: item.messageId,
        sourceFilename: item.filename,
        sourceRelativePath: `sample_emails/${item.filename}`,
        mimeType: 'message/rfc822',
        contentHashSha256: 'a'.repeat(64),
        relationships: canonicalRelationships
          .filter((relation) => relation.from === item.seedKey)
          .map((relation) => ({
            type: relation.type,
            evidence: evidenceIds.get(relation.to),
          })),
      }).toObject(),
    ),
    ...canonicalImages.map((item) =>
      new Evidence({
        _id: evidenceIds.get(item.seedKey),
        seedKey: item.seedKey,
        sourceDataset: 'test',
        travelRequest: travelId,
        kind: 'IMAGE',
        classification: 'SUPPORTING_DOCUMENT',
        sourceFilename: item.filename,
        sourceRelativePath: `receipts/${item.filename}`,
        mimeType: 'image/png',
        contentHashSha256: 'b'.repeat(64),
      }).toObject(),
    ),
  ];
  const expenses = canonicalExpenses.map(({ evidenceKeys, ...item }, index) =>
    new Expense({
      ...item,
      _id: objectId(300 + index),
      sourceDataset: 'test',
      travelRequest: travelId,
      employee: employees[0]!._id,
      sourceEvidence: evidenceKeys.map((key) => evidenceIds.get(key)),
    }).toObject(),
  );
  const travel = new TravelRequest({
    _id: travelId,
    seedKey: 'fixture-travel',
    sourceDataset: 'test',
    employee: employees[0]!._id,
    origin: 'Pune',
    destination: 'Bengaluru',
    startDate: '2026-06-16',
    endDate: '2026-06-20',
    purpose: 'Canonical fixture',
    travelType: 'DOMESTIC',
    currency: 'INR',
    costCentre: 'CE110',
    estimatedSpendMinor: 4800000,
    advanceRequestedMinor: 2000000,
    advanceDisbursedMinor: 2000000,
    plannedLodgingNights: 4,
    preTravelApprovals: [
      {
        approver: employees[1]!._id,
        role: 'REPORTING_MANAGER',
        decision: 'APPROVED',
        approvedAt: new Date('2026-06-08T18:40:55+05:30'),
        evidence: evidenceIds.get('evidence-email-02'),
      },
    ],
  }).toObject();
  const claim = new Claim({
    _id: objectId(400),
    seedKey: 'fixture-claim',
    sourceDataset: 'test',
    travelRequest: travelId,
    employee: employees[0]!._id,
    currency: 'INR',
    status: 'DRAFT',
    expenses: expenses.map((item) => item._id),
    approvals: [],
  }).toObject();
  return { claim, travel, expenses, evidence };
}
export function canonicalContext(): WorkflowContext {
  const data = canonicalDocuments();
  const input = assembleClaimPolicyInput(
    data.claim,
    data.travel,
    data.expenses,
    data.evidence,
  );
  return contextFromInput(input, data);
}
function contextFromInput(
  input: PolicyInput,
  data: ReturnType<typeof canonicalDocuments>,
): WorkflowContext {
  return {
    claim: workflowClaim(data.claim),
    claimant,
    hierarchy: actors,
    policy: evaluateClaimPolicy(input),
    policyInputHash: policyInputHash(input),
  };
}
export function resolvedCanonicalContext(): WorkflowContext {
  const data = canonicalDocuments();
  const input = assembleClaimPolicyInput(
    data.claim,
    data.travel,
    data.expenses,
    data.evidence,
  );
  const dinnerId = data.expenses
    .find((item) => item.componentType === 'DINNER')!
    ._id.toString();
  const taxId = data.expenses
    .find((item) => item.componentType === 'HOTEL_MIXED_TAX')!
    ._id.toString();
  input.expenses = input.expenses.map((item) =>
    item.key === dinnerId
      ? { ...item, included: false }
      : item.key === taxId
        ? {
            ...item,
            hotelTaxResolution: {
              reimbursableMinor: 200000,
              disallowedMinor: 30400,
              note: 'Hypothetical complete review only',
            },
          }
        : item,
  );
  return contextFromInput(input, data);
}
export function readyDocuments(amountMinor = 3000000, advanceMinor = 2000000) {
  const data = canonicalDocuments();
  const original = data.expenses.find((item) => item.componentType === 'RIDE')!;
  data.expenses = [
    new Expense({
      ...original,
      seedKey: 'hypothetical-cost',
      amountMinor,
    }).toObject(),
  ];
  data.claim = new Claim({
    ...data.claim,
    expenses: data.expenses.map((item) => item._id),
  }).toObject();
  data.travel.advanceDisbursedMinor = advanceMinor;
  return data;
}
export function readyContext(
  amountMinor = 3000000,
  advanceMinor = 2000000,
): WorkflowContext {
  const data = readyDocuments(amountMinor, advanceMinor);
  return contextFromInput(
    assembleClaimPolicyInput(
      data.claim,
      data.travel,
      data.expenses,
      data.evidence,
    ),
    data,
  );
}
export function applied(
  context: WorkflowContext,
  plan: WorkflowPlan,
): WorkflowContext {
  return {
    ...context,
    claim: {
      ...context.claim,
      status: plan.status,
      reviewCycle: plan.reviewCycle,
      reviewRoute: plan.reviewRoute,
      reviewInputHash: plan.reviewInputHash,
      finance: plan.finance,
      workflowVersion: context.claim.workflowVersion + 1,
      approvals: [
        ...context.claim.approvals,
        ...(plan.approval ? [plan.approval] : []),
      ],
      workflowHistory: [...context.claim.workflowHistory, plan.event],
    },
  };
}
