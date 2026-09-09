import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import request from 'supertest';
import type { Response } from 'supertest';
import mongoose from 'mongoose';
import { createApp, logger } from '../../app.js';
import { Claim } from '../../modules/claims/claim.model.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import {
  canonicalDocuments,
  readyDocuments,
  claimant,
  suresh,
  meera,
  ravi,
  kavitha,
  deepa,
} from '../../domain/claims/claimWorkflow.fixtures.js';
import type {
  serializeClaim,
  serializeTravel,
  serializeEvidence,
  serializeExpense,
  serializeSettlement,
  serializeWorkflow,
} from './serializers.js';
import { apiDatabase } from './api.fixtures.js';

logger.level = 'silent';
const app = createApp({
  NODE_ENV: 'development',
  CLIENT_ORIGIN: 'http://localhost:5173',
});
const base = '/api/v1';
const get = (path: string, actor = claimant) =>
  request(app)
    .get(`${base}${path}`)
    .set('X-Demo-Employee-Code', actor.employeeCode);
const post = (
  path: string,
  actor = claimant,
  body: Record<string, unknown> = {},
) =>
  request(app)
    .post(`${base}${path}`)
    .set('X-Demo-Employee-Code', actor.employeeCode)
    .send(body);
const data = <T>(response: Response): T => (response.body as { data: T }).data;
const count = (response: Response) =>
  (response.body as { meta: { count: number } }).meta.count;
const claimView = (response: Response) =>
  data<ReturnType<typeof serializeClaim>>(response);
const workflowView = (response: Response) =>
  data<ReturnType<typeof serializeWorkflow>>(response);
function error(response: Response, status: number, code: string) {
  assert.equal(response.status, status, response.text);
  const body = response.body as { error: { code: string; message: string } };
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  assert.equal(response.text.includes('stack'), false);
}
function setup(
  t: { after(fn: () => void): void },
  documents = canonicalDocuments(),
) {
  t.after(() => mock.restoreAll());
  return apiDatabase(documents);
}
const claimPath = (database: ReturnType<typeof apiDatabase>) =>
  `/claims/${database.claim._id.toString()}`;
const expensePath = (
  database: ReturnType<typeof apiDatabase>,
  component: string,
) =>
  `${claimPath(database)}/expenses/${database.data.expenses.find((item) => item.componentType === component)!._id.toString()}`;
async function resolveCanonical(database: ReturnType<typeof apiDatabase>) {
  assert.equal(
    (
      await post(`${expensePath(database, 'DINNER')}/exclude`, claimant, {
        reason: 'Missing named attendees and prior approval',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        `${expensePath(database, 'HOTEL_MIXED_TAX')}/resolve`,
        claimant,
        {
          reimbursableMinor: 200000,
          disallowedMinor: 30400,
          reason: 'Hypothetical reviewed allocation, not a canonical fact',
        },
      )
    ).status,
    200,
  );
}
async function financeReviewed(database: ReturnType<typeof apiDatabase>) {
  const path = claimPath(database);
  assert.equal((await post(`${path}/submit`)).status, 200);
  for (const required of database.claim.reviewRoute) {
    const actor =
      required.employeeId.toString() === suresh.employeeId ? suresh : meera;
    assert.equal((await post(`${path}/approve`, actor)).status, 200);
  }
  assert.equal(database.claim.status, 'FINANCE_REVIEW');
}

// All routes/middleware/services below are real. Only Mongo queries use isolated memory fixtures.
test('health and disconnected readiness stay public without database configuration', async () => {
  assert.deepEqual((await request(app).get('/health').expect(200)).body, {
    status: 'ok',
  });
  assert.deepEqual((await request(app).get('/ready').expect(503)).body, {
    status: 'not_ready',
    database: 'disconnected',
  });
});
test('readiness reports connected state without requiring identity', async (t) => {
  const previousState = mongoose.connection.readyState;
  t.after(() => {
    Reflect.set(mongoose.connection, 'readyState', previousState);
  });
  Reflect.set(mongoose.connection, 'readyState', 1);
  assert.deepEqual((await request(app).get('/ready').expect(200)).body, {
    status: 'ready',
    database: 'connected',
  });
});
test('public demo users are sorted and expose only role-switching fields', async (t) => {
  setup(t);
  const response = await request(app).get(`${base}/demo/users`).expect(200);
  const users = data<
    {
      id: string;
      employeeCode: string;
      name: string;
      organizationalRole: string;
    }[]
  >(response);
  assert.equal(users.length, 9);
  assert.equal(count(response), 9);
  assert.deepEqual(
    users.map((item) => item.employeeCode),
    users.map((item) => item.employeeCode).sort(),
  );
  assert.deepEqual(Object.keys(users[0]!).sort(), [
    'employeeCode',
    'id',
    'name',
    'organizationalRole',
  ]);
});
test('protected routes require an explicit valid backend-resolved identity', async (t) => {
  setup(t);
  error(
    await request(app).get(`${base}/claims`),
    401,
    'DEMO_IDENTITY_REQUIRED',
  );
  error(
    await request(app)
      .get(`${base}/claims`)
      .set('X-Demo-Employee-Code', 'NX-9999'),
    401,
    'IDENTITY_NOT_FOUND',
  );
  error(
    await request(app)
      .get(`${base}/claims`)
      .set('X-Demo-Employee-Code', 'invalid'),
    400,
    'INVALID_REQUEST',
  );
  assert.equal((await get('/claims')).status, 200);
});
test('forged headers and body roles cannot grant another employee access', async (t) => {
  const database = setup(t);
  error(
    await get(claimPath(database), deepa).set('X-Demo-Role', 'FINANCE'),
    403,
    'ACTION_NOT_ALLOWED',
  );
  error(
    await post(`${claimPath(database)}/submit`, deepa, {
      role: 'FINANCE',
      nextStatus: 'PAID',
    }),
    400,
    'INVALID_BODY',
  );
  error(
    await post(`${claimPath(database)}/submit`, deepa),
    403,
    'NOT_CLAIMANT',
  );
  assert.equal(database.writeCount, 0);
});
for (const route of [
  '/claims/not-an-id',
  '/travel-requests/not-an-id',
  '/evidence/not-an-id',
])
  test(`malformed ID rejected: ${route}`, async (t) => {
    setup(t);
    error(await get(route), 400, 'INVALID_ID');
  });
for (const [route, code] of [
  ['claims', 'CLAIM_NOT_FOUND'],
  ['travel-requests', 'TRAVEL_REQUEST_NOT_FOUND'],
  ['evidence', 'EVIDENCE_NOT_FOUND'],
]) {
  test(`valid but absent ${route} ID returns 404`, async (t) => {
    setup(t);
    error(await get(`/${route}/${'f'.repeat(24)}`), 404, code!);
  });
}
test('claimant sees own trip and missing business Travel Request ID stays null', async (t) => {
  const database = setup(t);
  const list = await get('/travel-requests').expect(200);
  assert.equal(count(list), 1);
  const response = await get(
    `/travel-requests/${database.data.travel._id.toString()}`,
  ).expect(200);
  const travel = data<ReturnType<typeof serializeTravel>>(response);
  assert.equal(travel.travelRequestId, null);
  assert.equal(travel.employee.employeeCode, 'NX-4471');
  assert.equal(travel.startDate, '2026-06-16');
  assert.equal(travel.estimatedSpendMinor, 4800000);
  assert.equal(response.text.includes('TRQ-2026-0000'), false);
  assert.equal(response.text.includes('__v'), false);
});
test('unrelated employee has empty lists and cannot read trip, claim or evidence details', async (t) => {
  const database = setup(t);
  assert.equal(count(await get('/claims', deepa).expect(200)), 0);
  assert.equal(count(await get('/travel-requests', deepa).expect(200)), 0);
  error(await get(claimPath(database), deepa), 403, 'ACTION_NOT_ALLOWED');
  error(
    await get(`/travel-requests/${database.data.travel._id.toString()}`, deepa),
    403,
    'ACTION_NOT_ALLOWED',
  );
  error(
    await get(`/evidence/${database.data.evidence[0]!._id.toString()}`, deepa),
    403,
    'ACTION_NOT_ALLOWED',
  );
});
test('all 17 evidence records remain visible with their inconvenient classifications', async (t) => {
  const database = setup(t);
  const response = await get(
    `/travel-requests/${database.data.travel._id.toString()}/evidence`,
  ).expect(200);
  const evidence = data<ReturnType<typeof serializeEvidence>[]>(response);
  assert.equal(count(response), 17);
  assert.equal(evidence.filter((item) => item.kind === 'IMAGE').length, 2);
  for (const classification of [
    'PAYMENT_FAILURE',
    'DUPLICATE',
    'CLAIMANT_MISMATCH',
    'NOISE',
  ])
    assert.ok(evidence.some((item) => item.classification === classification));
  assert.deepEqual(
    evidence.map((item) => item.sourceFilename),
    evidence.map((item) => item.sourceFilename).sort(),
  );
});
test('evidence filters are strict and detail preserves relative asset references', async (t) => {
  const documents = canonicalDocuments();
  const imageIndex = documents.evidence.findIndex(
    (item) => item.kind === 'IMAGE',
  );
  const source = documents.evidence[imageIndex]!;
  documents.evidence[imageIndex] = new Evidence({
    ...source,
    assetReference: source.sourceRelativePath,
  }).toObject();
  const database = setup(t, documents);
  const path = `/travel-requests/${database.data.travel._id.toString()}/evidence`;
  assert.equal(count(await get(`${path}?kind=IMAGE`).expect(200)), 2);
  assert.equal(
    count(await get(`${path}?classification=DUPLICATE`).expect(200)),
    1,
  );
  error(await get(`${path}?classification=INVALID`), 400, 'INVALID_REQUEST');
  error(await get(`${path}?role=FINANCE`), 400, 'INVALID_REQUEST');
  const response = await get(`/evidence/${source._id.toString()}`).expect(200);
  assert.equal(
    data<ReturnType<typeof serializeEvidence>>(response).assetReference,
    source.sourceRelativePath,
  );
  assert.equal(response.text.includes('_id'), false);
});
test('14 source expenses retain integer money, company flights, dinner and hotel components', async (t) => {
  const database = setup(t);
  const response = await get(
    `/travel-requests/${database.data.travel._id.toString()}/expenses`,
  ).expect(200);
  const expenses = data<ReturnType<typeof serializeExpense>[]>(response);
  assert.equal(count(response), 14);
  assert.ok(expenses.every((item) => Number.isSafeInteger(item.amountMinor)));
  assert.equal(expenses.filter((item) => item.paidBy === 'COMPANY').length, 2);
  assert.equal(
    expenses.filter((item) => item.componentType === 'ROOM').length,
    3,
  );
  assert.ok(expenses.some((item) => item.componentType === 'DINNER'));
  assert.ok(expenses.some((item) => item.componentType === 'HOTEL_MIXED_TAX'));
});
test('claim serializer strips internals and returns controlled nested workflow fields', async (t) => {
  const database = setup(t);
  const response = await get(claimPath(database)).expect(200);
  const claim = claimView(response);
  assert.equal(claim.expenseCount, 14);
  assert.equal(claim.reviewCycle, 0);
  assert.deepEqual(claim.expenseReviews, []);
  assert.deepEqual(claim.workflowHistory, []);
  assert.equal(response.text.includes('reviewInputHash'), false);
  assert.equal(response.text.includes('__v'), false);
  assert.equal(response.text.includes('_id'), false);
});
test('canonical settlement/readiness/validation expose real provisional policy results', async (t) => {
  const database = setup(t);
  const path = claimPath(database);
  const settlement = data<ReturnType<typeof serializeSettlement>>(
    await get(`${path}/settlement`).expect(200),
  );
  assert.deepEqual(settlement, {
    employeePaidGrossMinor: 2731804,
    companyPaidGrossMinor: 1055600,
    knownEligibleMinor: 2192904,
    knownDisallowedMinor: 83000,
    unresolvedMinor: 455900,
    excludedMinor: 0,
    advanceMinor: 2000000,
    payableMinor: null,
    recoverableMinor: null,
    isFinal: false,
  });
  const readiness = data<{
    isReadyToSubmit: boolean;
    blockingIssues: { code: string }[];
  }>(await get(`${path}/readiness`).expect(200));
  assert.equal(readiness.isReadyToSubmit, false);
  assert.ok(
    readiness.blockingIssues.some(
      (item) => item.code === 'HOTEL_TAX_ALLOCATION_UNRESOLVED',
    ),
  );
  const validation = data<{
    findings: { code: string; severity: string; policyReference: string }[];
  }>(await get(`${path}/validation`).expect(200));
  for (const code of [
    'MISSING_TRAVEL_REQUEST_ID',
    'MISSING_PRETRAVEL_HOD_APPROVAL',
    'ADVANCE_CAP_UNDETERMINED',
  ])
    assert.ok(validation.findings.some((item) => item.code === code));
  assert.ok(
    validation.findings.every((item) => item.policyReference && item.severity),
  );
});
test('canonical submit returns 422 with findings and performs no write', async (t) => {
  const database = setup(t);
  const response = await post(`${claimPath(database)}/submit`);
  error(response, 422, 'POLICY_NOT_READY');
  assert.ok(
    (response.body as { error: { details: { findings: unknown[] } } }).error
      .details.findings.length > 0,
  );
  assert.equal(database.claim.status, 'DRAFT');
  assert.equal(database.writeCount, 0);
});
test('exclude/restore persist Claim review and append history without changing sources', async (t) => {
  const database = setup(t);
  const original = JSON.stringify(database.data.expenses);
  const path = expensePath(database, 'DINNER');
  const excluded = claimView(
    await post(`${path}/exclude`, claimant, {
      reason: 'No attendee list',
    }).expect(200),
  );
  assert.equal(excluded.expenseReviews[0]!.included, false);
  assert.equal(excluded.expenseReviews[0]!.exclusionReason, 'No attendee list');
  assert.equal(excluded.workflowVersion, 1);
  assert.match(excluded.expenseReviews[0]!.updatedAt!, /^\d{4}-\d{2}-\d{2}T/);
  const restored = claimView(await post(`${path}/restore`).expect(200));
  assert.equal(restored.expenseReviews[0]!.included, true);
  assert.equal(restored.expenseReviews[0]!.exclusionReason, null);
  assert.deepEqual(
    restored.expenseReviewHistory.map((item) => item.action),
    ['EXCLUDED', 'RESTORED'],
  );
  assert.equal(restored.workflowVersion, 2);
  assert.equal(JSON.stringify(database.data.expenses), original);
  await new Claim(database.claim).validate();
});
test('review edits deny non-claimants, missing expenses and missing reasons', async (t) => {
  const database = setup(t);
  error(
    await post(`${expensePath(database, 'DINNER')}/exclude`, deepa, {
      reason: 'Unrelated',
    }),
    403,
    'NOT_CLAIMANT',
  );
  error(
    await post(`${expensePath(database, 'DINNER')}/exclude`),
    400,
    'INVALID_BODY',
  );
  error(
    await post(`${claimPath(database)}/expenses/${'f'.repeat(24)}/restore`),
    404,
    'EXPENSE_NOT_FOUND',
  );
  error(
    await post(`${claimPath(database)}/expenses/invalid/restore`),
    400,
    'INVALID_ID',
  );
  assert.equal(database.writeCount, 0);
});
test('valid explicit allocation persists only on Claim and makes resolved review ready', async (t) => {
  const database = setup(t);
  const original = JSON.stringify({
    expenses: database.data.expenses,
    evidence: database.data.evidence,
  });
  await resolveCanonical(database);
  const readiness = data<{
    isReadyToSubmit: boolean;
    warnings: { code: string }[];
  }>(await get(`${claimPath(database)}/readiness`).expect(200));
  assert.equal(readiness.isReadyToSubmit, true);
  assert.ok(
    readiness.warnings.some(
      (item) => item.code === 'MISSING_PRETRAVEL_HOD_APPROVAL',
    ),
  );
  assert.equal(database.claim.expenseReviewHistory.at(-1)!.action, 'RESOLVED');
  assert.equal(database.claim.workflowVersion, 2);
  assert.equal(
    JSON.stringify({
      expenses: database.data.expenses,
      evidence: database.data.evidence,
    }),
    original,
  );
  await new Claim(database.claim).validate();
});
for (const body of [
  { reimbursableMinor: 100000, disallowedMinor: 0, reason: 'Incomplete sum' },
  { reimbursableMinor: 230400, disallowedMinor: 0 },
  { reimbursableMinor: -1, disallowedMinor: 230401, reason: 'Negative' },
  { reimbursableMinor: 0.5, disallowedMinor: 230399.5, reason: 'Fractional' },
  { reimbursableMinor: 230400, disallowedMinor: 0, reason: ' ' },
])
  test(`invalid manual allocation is rejected: ${body.reason ?? 'missing reason'}`, async (t) => {
    const database = setup(t);
    error(
      await post(
        `${expensePath(database, 'HOTEL_MIXED_TAX')}/resolve`,
        claimant,
        body,
      ),
      422,
      'INVALID_MANUAL_RESOLUTION',
    );
    assert.equal(database.writeCount, 0);
  });
test('manual allocation cannot override another expense category', async (t) => {
  const database = setup(t);
  error(
    await post(`${expensePath(database, 'LAUNDRY')}/resolve`, claimant, {
      reimbursableMinor: 45000,
      disallowedMinor: 0,
      reason: 'Attempt to override policy',
    }),
    422,
    'INVALID_MANUAL_RESOLUTION',
  );
});
test('ready submission is server-routed and active review edits are rejected', async (t) => {
  const database = setup(t);
  await resolveCanonical(database);
  const response = await post(`${claimPath(database)}/submit`).expect(200);
  assert.equal(workflowView(response).currentStatus, 'MANAGER_REVIEW');
  assert.equal(workflowView(response).reviewCycle, 1);
  error(
    await post(`${expensePath(database, 'DINNER')}/restore`),
    403,
    'ACTION_NOT_ALLOWED',
  );
});
test('caller cannot supply workflow status, role, cycle or approver fields', async (t) => {
  const database = setup(t, readyDocuments());
  for (const body of [
    { nextStatus: 'PAID' },
    { reviewCycle: 10 },
    { approverId: meera.employeeId },
    { role: 'FINANCE' },
  ]) {
    error(
      await post(`${claimPath(database)}/submit`, claimant, body),
      400,
      'INVALID_BODY',
    );
  }
  assert.equal(database.writeCount, 0);
});
test('business queue and read access follow the exact current RM then HOD', async (t) => {
  const database = setup(t, readyDocuments());
  const path = claimPath(database);
  await post(`${path}/submit`).expect(200);
  assert.equal(count(await get('/approvals', suresh).expect(200)), 1);
  assert.equal(count(await get('/approvals', meera).expect(200)), 0);
  await get(path, suresh).expect(200);
  error(await get(path, meera), 403, 'ACTION_NOT_ALLOWED');
  error(await post(`${path}/approve`, meera), 403, 'NOT_REQUIRED_APPROVER');
  await post(`${path}/approve`, suresh, { remarks: 'Reviewed' }).expect(200);
  assert.equal(database.claim.status, 'HOD_REVIEW');
  assert.equal(count(await get('/approvals', meera).expect(200)), 1);
  assert.equal(count(await get('/approvals', suresh).expect(200)), 0);
  await get(path, meera).expect(200);
  await post(`${path}/approve`, meera).expect(200);
  assert.equal(database.claim.status, 'FINANCE_REVIEW');
});
test('return requires remarks and resubmission restarts a fresh review cycle', async (t) => {
  const database = setup(t, readyDocuments());
  const path = claimPath(database);
  await post(`${path}/submit`).expect(200);
  error(
    await post(`${path}/return`, suresh, { remarks: ' ' }),
    422,
    'RETURN_REMARKS_REQUIRED',
  );
  await post(`${path}/return`, suresh, { remarks: 'Review again' }).expect(200);
  assert.equal(database.claim.status, 'RETURNED');
  error(await post(`${path}/resubmit`, deepa), 403, 'NOT_CLAIMANT');
  await post(`${path}/resubmit`).expect(200);
  assert.equal(database.claim.status, 'MANAGER_REVIEW');
  assert.equal(database.claim.reviewCycle, 2);
  assert.equal(database.claim.approvals[0]!.decision, 'RETURNED');
});
test('Finance queue and context require Finance-relevant state and backend role', async (t) => {
  const database = setup(t, readyDocuments());
  const path = claimPath(database);
  error(await get('/finance/claims'), 403, 'FINANCE_ROLE_REQUIRED');
  assert.equal(count(await get('/finance/claims', ravi).expect(200)), 0);
  error(await get(path, ravi), 403, 'ACTION_NOT_ALLOWED');
  await financeReviewed(database);
  for (const actor of [ravi, kavitha]) {
    assert.equal(count(await get('/finance/claims', actor).expect(200)), 1);
    await get(path, actor).expect(200);
  }
  error(
    await post(`${path}/finance/verify`, suresh).set('X-Demo-Role', 'FINANCE'),
    403,
    'FINANCE_ROLE_REQUIRED',
  );
  await post(`${path}/finance/verify`, ravi).expect(200);
  assert.equal(database.claim.finance!.verifiedBy.toString(), ravi.employeeId);
});
for (const date of ['2099-07-10', '2099-07-25'])
  test(`Finance can schedule ${date} after verification`, async (t) => {
    const database = setup(t, readyDocuments());
    await financeReviewed(database);
    const path = claimPath(database);
    await post(`${path}/finance/verify`, kavitha).expect(200);
    await post(`${path}/finance/schedule-payment`, ravi, {
      scheduledFor: date,
    }).expect(200);
    assert.equal(database.claim.status, 'PAYMENT_SCHEDULED');
  });
test('Finance dates, verification state and payment references are enforced', async (t) => {
  const database = setup(t, readyDocuments());
  const path = claimPath(database);
  error(await post(`${path}/finance/verify`, ravi), 403, 'ACTION_NOT_ALLOWED');
  await financeReviewed(database);
  error(
    await post(`${path}/finance/schedule-payment`, ravi, {
      scheduledFor: '2099-07-10',
    }),
    403,
    'ACTION_NOT_ALLOWED',
  );
  await post(`${path}/finance/verify`, ravi).expect(200);
  error(
    await post(`${path}/finance/schedule-payment`, ravi, {
      scheduledFor: '2099-07-12',
    }),
    422,
    'INVALID_PAYMENT_DATE',
  );
  error(
    await post(`${path}/finance/schedule-payment`, ravi, {
      scheduledFor: '2099-02-30',
    }),
    400,
    'INVALID_BODY',
  );
  await post(`${path}/finance/schedule-payment`, ravi, {
    scheduledFor: '2099-07-10',
  }).expect(200);
  error(
    await post(`${path}/finance/mark-paid`, ravi),
    422,
    'PAYMENT_REFERENCE_REQUIRED',
  );
  error(
    await post(`${path}/finance/mark-paid`, claimant, {
      paymentReference: 'DEMO-TEST',
    }),
    403,
    'FINANCE_ROLE_REQUIRED',
  );
  // The isolated fixture now represents an already-arrived valid payment run.
  database.claim.finance!.paymentScheduledFor = '2000-01-10';
  await post(`${path}/finance/mark-paid`, kavitha, {
    paymentReference: 'DEMO-TEST',
  }).expect(200);
  assert.equal(database.claim.status, 'PAID');
  assert.equal(database.claim.finance!.paymentReference, 'DEMO-TEST');
});
for (const amount of [1500000, 2000000])
  test(`non-payable settlement ${amount} cannot schedule reimbursement`, async (t) => {
    const database = setup(t, readyDocuments(amount));
    await financeReviewed(database);
    const path = claimPath(database);
    await post(`${path}/finance/verify`, ravi).expect(200);
    error(
      await post(`${path}/finance/schedule-payment`, ravi, {
        scheduledFor: '2099-07-10',
      }),
      403,
      'ACTION_NOT_ALLOWED',
    );
    assert.equal(database.claim.status, 'FINANCE_REVIEW');
  });
test('lost conditional approval match maps to 409 without a second event', async (t) => {
  const database = setup(t, readyDocuments());
  const path = claimPath(database);
  await post(`${path}/submit`).expect(200);
  database.conflictNextWrite();
  error(await post(`${path}/approve`, suresh), 409, 'CLAIM_STATE_CONFLICT');
  assert.equal(database.claim.approvals.length, 0);
});
test('two review edits from the same revision yield one success and one 409', async (t) => {
  const database = setup(t);
  database.raceNextWrites();
  const responses = await Promise.all([
    post(`${expensePath(database, 'DINNER')}/exclude`, claimant, {
      reason: 'First review',
    }),
    post(`${expensePath(database, 'HOTEL_MIXED_TAX')}/exclude`, claimant, {
      reason: 'Second review',
    }),
  ]);
  assert.deepEqual(responses.map((item) => item.status).sort(), [200, 409]);
  error(
    responses.find((item) => item.status === 409)!,
    409,
    'CLAIM_STATE_CONFLICT',
  );
  assert.equal(database.claim.expenseReviewHistory.length, 1);
  assert.equal(database.claim.workflowVersion, 1);
});
test('malformed JSON and unexpected database failures have safe consistent errors', async (t) => {
  const database = setup(t);
  error(
    await request(app)
      .post(`${base}${claimPath(database)}/submit`)
      .set('X-Demo-Employee-Code', claimant.employeeCode)
      .set('Content-Type', 'application/json')
      .send('{broken'),
    400,
    'INVALID_BODY',
  );
  mock.method(Employee, 'findOne', () => {
    throw new Error('internal-driver-detail');
  });
  const response = await get('/claims');
  error(response, 500, 'INTERNAL_ERROR');
  assert.equal(response.text.includes('internal-driver-detail'), false);
});
test('exact-origin CORS and authenticated API not-found handling remain consistent', async (t) => {
  setup(t);
  const response = await request(app)
    .options(`${base}/claims`)
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'X-Demo-Employee-Code')
    .expect(204);
  assert.equal(
    response.headers['access-control-allow-origin'],
    'http://localhost:5173',
  );
  error(await get('/unknown'), 404, 'NOT_FOUND');
});

test('production CORS advertises only the configured frontend origin', async () => {
  const productionOrigin = 'https://ai-planet-frontend.vercel.app';
  const unrelatedOrigin = 'http://localhost:5173';

  const productionApp = createApp({
    NODE_ENV: 'production',
    CLIENT_ORIGIN: productionOrigin,
  });

  const allowed = await request(productionApp)
    .options(`${base}/claims`)
    .set('Origin', productionOrigin)
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'X-Demo-Employee-Code')
    .expect(204);

  assert.equal(
    allowed.headers['access-control-allow-origin'],
    productionOrigin,
  );

  const unrelated = await request(productionApp)
    .options(`${base}/claims`)
    .set('Origin', unrelatedOrigin)
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'X-Demo-Employee-Code')
    .expect(204);

  assert.equal(
    unrelated.headers['access-control-allow-origin'],
    productionOrigin,
  );

  assert.notEqual(
    unrelated.headers['access-control-allow-origin'],
    unrelatedOrigin,
  );
});
