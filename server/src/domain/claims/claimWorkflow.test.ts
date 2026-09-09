import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { Claim } from '../../modules/claims/claim.model.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { requiredApprovalLevels } from '../policy/approvals.js';
import { resolveApprovers } from './approvers.js';
import { requireApprover } from './authorization.js';
import {
  assembleClaimPolicyInput,
  workflowClaim,
} from './claimPolicyContext.js';
import {
  conditionalWorkflowWrite,
  persistWorkflowTransition,
} from './claimWorkflow.persistence.js';
import {
  approveClaim,
  submitClaim,
  returnClaim,
  resubmitClaim,
  verifyClaimByFinance,
} from './claimWorkflow.service.js';
import { resolveDemoActor } from './identity.js';
import { WorkflowError } from './errors.js';
import type { WorkflowErrorCode } from './errors.js';
import { planClaimTransition, settlementDirection } from './transitions.js';
import type { Actor, WorkflowCommand, WorkflowContext } from './types.js';
import { businessLevels, claimStatuses } from './types.js';
import {
  actors,
  employees,
  claimant,
  suresh,
  meera,
  arvind,
  nandita,
  ravi,
  kavitha,
  deepa,
  actionTime,
  canonicalDocuments,
  canonicalContext,
  resolvedCanonicalContext,
  readyDocuments,
  readyContext,
  applied,
} from './claimWorkflow.fixtures.js';

const errorCode = (code: WorkflowErrorCode) => (error: unknown) =>
  error instanceof WorkflowError && error.code === code;
const act = (
  context: WorkflowContext,
  actor: Actor,
  command: WorkflowCommand,
  now = actionTime,
) => applied(context, planClaimTransition(context, actor, command, now));
function businessApproved(context = readyContext()): WorkflowContext {
  let state = act(context, context.claimant, { action: 'SUBMITTED' });
  for (const approver of state.claim.reviewRoute)
    state = act(
      state,
      actors.find((item) => item.employeeId === approver.employeeId)!,
      { action: 'APPROVED' },
    );
  return state;
}
function query<T>(read: () => T | Promise<T>) {
  return {
    lean() {
      return this;
    },
    select() {
      return this;
    },
    async exec() {
      return read();
    },
  };
}

// Only Mongoose query boundaries are mocked. The real identity, assembler, planner and conditional writer run.
function mockDatabase(data = readyDocuments()) {
  let stored = data.claim;
  const writes: ReturnType<typeof conditionalWorkflowWrite>[] = [];
  mock.method(Employee, 'findOne', (filter: { employeeCode: string }) =>
    query(
      () =>
        employees.find((item) => item.employeeCode === filter.employeeCode) ??
        null,
    ),
  );
  mock.method(Employee, 'findById', (id: { toString(): string }) =>
    query(
      () =>
        employees.find((item) => item._id.toString() === id.toString()) ?? null,
    ),
  );
  mock.method(Claim, 'findById', () =>
    query(() => new Claim(stored).toObject()),
  );
  mock.method(TravelRequest, 'findById', () => query(() => data.travel));
  mock.method(Expense, 'find', () => query(() => data.expenses));
  mock.method(Evidence, 'find', () => query(() => data.evidence));
  mock.method(
    Claim,
    'findOneAndUpdate',
    (
      filter: ReturnType<typeof conditionalWorkflowWrite>['filter'],
      update: ReturnType<typeof conditionalWorkflowWrite>['update'],
    ) =>
      query(() => {
        writes.push({ filter, update });
        const expectedCycle = filter.$and[0]!;
        const expectedVersion = filter.$and[1]!;
        const cycleMatches =
          'reviewCycle' in expectedCycle
            ? expectedCycle.reviewCycle === stored.reviewCycle
            : (stored.reviewCycle ?? 0) === 0;
        const versionMatches =
          'workflowVersion' in expectedVersion
            ? expectedVersion.workflowVersion === stored.workflowVersion
            : (stored.workflowVersion ?? 0) === 0;
        if (
          stored._id.toString() !== filter._id ||
          stored.status !== filter.status ||
          !cycleMatches ||
          !versionMatches
        )
          return null;
        const next = {
          ...stored,
          ...update.$set,
          workflowVersion:
            (stored.workflowVersion ?? 0) + update.$inc.workflowVersion,
          workflowHistory: [
            ...stored.workflowHistory,
            update.$push.workflowHistory,
          ],
          approvals: [
            ...stored.approvals,
            ...(update.$push.approvals ? [update.$push.approvals] : []),
          ],
        };
        stored = new Claim(next).toObject();
        if (update.$unset) delete stored.finance;
        return { _id: stored._id };
      }),
  );
  return {
    get claim() {
      return stored;
    },
    writes,
  };
}

test('demo identity resolves canonical employee and derives role from Employee data', async (t) => {
  t.after(() => mock.restoreAll());
  mockDatabase();
  const actor = await resolveDemoActor('NX-4471');
  assert.equal(actor.name, 'Chaitanya Reddy');
  assert.equal(actor.organizationalRole, 'EMPLOYEE');
  assert.equal(actor.reportingManagerId, suresh.employeeId);
  await assert.rejects(
    resolveDemoActor('unknown'),
    errorCode('IDENTITY_NOT_FOUND'),
  );
  await assert.rejects(resolveDemoActor('  '), errorCode('IDENTITY_NOT_FOUND'));
});

test('service ignores forged actor roles and rejects mismatched identities', async (t) => {
  t.after(() => mock.restoreAll());
  mockDatabase();
  await assert.rejects(
    submitClaim(readyContext().claim.claimId, {
      ...deepa,
      organizationalRole: 'MANAGING_DIRECTOR',
    }),
    errorCode('NOT_CLAIMANT'),
  );
  await assert.rejects(
    submitClaim(readyContext().claim.claimId, {
      ...claimant,
      employeeId: deepa.employeeId,
    }),
    errorCode('IDENTITY_NOT_FOUND'),
  );
});

test('canonical hierarchy resolves the exact four approvers through references', () => {
  const route = resolveApprovers(claimant, businessLevels, actors);
  assert.deepEqual(
    route.map((item) => item.employeeId),
    [suresh, meera, arvind, nandita].map((item) => item.employeeId),
  );
  assert.deepEqual(
    route.map((item) => item.level),
    businessLevels,
  );
});

test('missing hierarchy or a cycle fails instead of choosing an arbitrary same-role employee', () => {
  assert.throws(
    () =>
      resolveApprovers(
        claimant,
        businessLevels,
        actors.filter((item) => item.employeeId !== meera.employeeId),
      ),
    errorCode('REQUIRED_APPROVER_NOT_FOUND'),
  );
  assert.throws(
    () =>
      resolveApprovers(
        claimant,
        businessLevels,
        actors.map((item) =>
          item.employeeId === suresh.employeeId
            ? { ...item, reportingManagerId: claimant.employeeId }
            : item,
        ),
      ),
    errorCode('REQUIRED_APPROVER_NOT_FOUND'),
  );
  const unrelated = { ...meera, employeeId: 'unrelated-hod' };
  assert.throws(
    () =>
      resolveApprovers(claimant, businessLevels, [
        ...actors.filter((item) => item.employeeId !== meera.employeeId),
        unrelated,
      ]),
    errorCode('REQUIRED_APPROVER_NOT_FOUND'),
  );
});

test('self-approval escalation skips claimant levels and uses the next higher real manager', () => {
  assert.deepEqual(resolveApprovers(suresh, ['REPORTING_MANAGER'], actors), [
    { level: 'HEAD_OF_DEPARTMENT', employeeId: meera.employeeId },
  ]);
  assert.deepEqual(
    resolveApprovers(
      meera,
      ['REPORTING_MANAGER', 'HEAD_OF_DEPARTMENT'],
      actors,
    ),
    [{ level: 'HEAD_OF_DIVISION', employeeId: arvind.employeeId }],
  );
  assert.throws(
    () => resolveApprovers(nandita, ['REPORTING_MANAGER'], actors),
    errorCode('REQUIRED_APPROVER_NOT_FOUND'),
  );
  const source = readyContext();
  source.claim = { ...source.claim, employeeId: suresh.employeeId };
  source.claimant = suresh;
  const submitted = act(source, suresh, { action: 'SUBMITTED' });
  assert.equal(submitted.claim.status, 'HOD_REVIEW');
  assert.throws(
    () => act(submitted, suresh, { action: 'APPROVED' }),
    errorCode('SELF_APPROVAL_FORBIDDEN'),
  );
});

for (const actor of [deepa, suresh])
  test(`${actor.name} cannot submit another employee's draft`, () => {
    assert.throws(
      () => act(readyContext(), actor, { action: 'SUBMITTED' }),
      errorCode('NOT_CLAIMANT'),
    );
  });

test('canonical unresolved submission is blocked and leaves draft and source facts unchanged', async (t) => {
  t.after(() => mock.restoreAll());
  const database = mockDatabase(canonicalDocuments());
  await assert.rejects(
    submitClaim(database.claim._id.toString(), claimant),
    errorCode('POLICY_NOT_READY'),
  );
  assert.equal(database.claim.status, 'DRAFT');
  assert.equal(database.claim.reviewCycle, 0);
  assert.equal(database.writes.length, 0);
  const context = canonicalContext();
  assert.equal(context.policy.employeePaidGrossMinor, 2731804);
  assert.equal(context.policy.unresolvedMinor, 455900);
});

test('hypothetical dinner exclusion and manual tax resolution permit submission without hiding history', () => {
  const source = resolvedCanonicalContext();
  assert.equal(source.policy.readiness.isReadyToSubmit, true);
  assert.equal(
    source.policy.findings.some(
      (item) => item.code === 'MISSING_PRETRAVEL_HOD_APPROVAL',
    ),
    true,
  );
  const result = act(source, claimant, { action: 'SUBMITTED' });
  assert.equal(result.claim.status, 'MANAGER_REVIEW');
  assert.deepEqual(
    result.claim.reviewRoute.map((item) => item.level),
    source.policy.requiredClaimApprovalLevels,
  );
});

test('ready RM plus HOD submission stores the first cycle, route and one audit event', async (t) => {
  t.after(() => mock.restoreAll());
  const database = mockDatabase();
  const result = await submitClaim(database.claim._id.toString(), claimant);
  assert.equal(result.currentStatus, 'MANAGER_REVIEW');
  assert.equal(result.reviewCycle, 1);
  assert.equal(result.workflowEvent.action, 'SUBMITTED');
  assert.equal(database.claim.approvals.length, 0);
  assert.equal(database.claim.workflowHistory.length, 1);
  assert.deepEqual(
    database.claim.reviewRoute.map((item) => item.level),
    ['REPORTING_MANAGER', 'HEAD_OF_DEPARTMENT'],
  );
  assert.match(database.claim.reviewInputHash!, /^[a-f0-9]{64}$/);
});

for (const [amount, expected] of [
  [3000000, ['MANAGER_REVIEW', 'HOD_REVIEW', 'FINANCE_REVIEW']],
  [
    8000000,
    ['MANAGER_REVIEW', 'HOD_REVIEW', 'DIVISION_REVIEW', 'FINANCE_REVIEW'],
  ],
  [
    20000001,
    [
      'MANAGER_REVIEW',
      'HOD_REVIEW',
      'DIVISION_REVIEW',
      'MD_REVIEW',
      'FINANCE_REVIEW',
    ],
  ],
] as const)
  test(`approval route for ${amount} consumes the policy result`, () => {
    let context = act(readyContext(amount), claimant, { action: 'SUBMITTED' });
    const states = [context.claim.status];
    assert.deepEqual(
      context.claim.reviewRoute.map((item) => item.level),
      requiredApprovalLevels(amount, 'DOMESTIC'),
    );
    for (const required of context.claim.reviewRoute) {
      const actor = actors.find(
        (item) => item.employeeId === required.employeeId,
      )!;
      context = act(context, actor, { action: 'APPROVED', remarks: 'Checked' });
      states.push(context.claim.status);
    }
    assert.deepEqual(states, expected);
    assert.equal(context.claim.approvals.length, expected.length - 1);
    assert.ok(
      context.claim.approvals.every(
        (item) => item.reviewCycle === 1 && item.decision === 'APPROVED',
      ),
    );
  });

for (const actor of [deepa, meera, ravi])
  test(`${actor.name} cannot approve manager review`, () => {
    const context = act(readyContext(), claimant, { action: 'SUBMITTED' });
    assert.throws(
      () => act(context, actor, { action: 'APPROVED' }),
      errorCode('NOT_REQUIRED_APPROVER'),
    );
  });
for (const actor of [suresh, ravi])
  test(`${actor.name} cannot approve HOD review`, () => {
    const context = act(
      act(readyContext(), claimant, { action: 'SUBMITTED' }),
      suresh,
      { action: 'APPROVED' },
    );
    assert.throws(
      () => act(context, actor, { action: 'APPROVED' }),
      errorCode('NOT_REQUIRED_APPROVER'),
    );
  });

test('same role alone and claimant identity do not confer approval authority', () => {
  const context = act(readyContext(), claimant, { action: 'SUBMITTED' });
  assert.throws(
    () => act(context, claimant, { action: 'APPROVED' }),
    errorCode('SELF_APPROVAL_FORBIDDEN'),
  );
  assert.throws(
    () =>
      requireApprover(
        context.claim,
        { ...suresh, employeeId: 'unrelated-manager' },
        context.claim.reviewRoute[0]!,
      ),
    errorCode('NOT_REQUIRED_APPROVER'),
  );
});

test('correct business approver returns with remarks and preserves approvals/history', () => {
  let context = act(
    act(readyContext(), claimant, { action: 'SUBMITTED' }),
    suresh,
    { action: 'APPROVED' },
  );
  context = act(context, meera, {
    action: 'RETURNED',
    remarks: ' Confirm receipt ',
  });
  assert.equal(context.claim.status, 'RETURNED');
  assert.equal(context.claim.approvals.length, 2);
  assert.deepEqual(
    context.claim.approvals.map((item) => item.decision),
    ['APPROVED', 'RETURNED'],
  );
  assert.equal(
    context.claim.workflowHistory.at(-1)!.remarks,
    'Confirm receipt',
  );
  assert.equal(context.claim.workflowHistory.length, 3);
});

test('return needs nonblank remarks and the exact current approver', () => {
  const context = act(readyContext(), claimant, { action: 'SUBMITTED' });
  assert.throws(
    () => act(context, suresh, { action: 'RETURNED', remarks: ' ' }),
    errorCode('RETURN_REMARKS_REQUIRED'),
  );
  assert.throws(
    () => act(context, meera, { action: 'RETURNED', remarks: 'Wrong stage' }),
    errorCode('NOT_REQUIRED_APPROVER'),
  );
  assert.throws(
    () => act(context, claimant, { action: 'RETURNED', remarks: 'Own claim' }),
    errorCode('SELF_APPROVAL_FORBIDDEN'),
  );
});

test('resubmission restarts the entire recalculated route and retains old-cycle decisions', () => {
  let context = act(
    act(readyContext(), claimant, { action: 'SUBMITTED' }),
    suresh,
    { action: 'APPROVED' },
  );
  context = act(context, meera, {
    action: 'RETURNED',
    remarks: 'Revise expenses',
  });
  const changed = readyContext(8000000);
  context = {
    ...context,
    policy: changed.policy,
    policyInputHash: changed.policyInputHash,
  };
  assert.throws(
    () => act(context, deepa, { action: 'RESUBMITTED' }),
    errorCode('NOT_CLAIMANT'),
  );
  context = act(context, claimant, { action: 'RESUBMITTED' });
  assert.equal(context.claim.reviewCycle, 2);
  assert.equal(context.claim.status, 'MANAGER_REVIEW');
  assert.equal(context.claim.approvals.length, 2);
  assert.equal(context.claim.reviewRoute.length, 3);
  assert.equal(context.claim.workflowHistory.at(-1)!.action, 'RESUBMITTED');
  context = act(context, suresh, { action: 'APPROVED' });
  assert.equal(context.claim.status, 'HOD_REVIEW');
  assert.equal(context.claim.approvals.at(-1)!.reviewCycle, 2);
});

test('returned claim must pass current policy again', () => {
  const returned = act(
    act(readyContext(), claimant, { action: 'SUBMITTED' }),
    suresh,
    { action: 'RETURNED', remarks: 'Review' },
  );
  assert.throws(
    () =>
      act({ ...returned, policy: canonicalContext().policy }, claimant, {
        action: 'RESUBMITTED',
      }),
    errorCode('POLICY_NOT_READY'),
  );
});

for (const actor of [ravi, kavitha])
  test(`${actor.name} can verify Finance but does not mark paid`, () => {
    const result = act(businessApproved(), actor, {
      action: 'FINANCE_VERIFIED',
    });
    assert.equal(result.claim.status, 'FINANCE_REVIEW');
    assert.equal(result.claim.finance!.verifiedBy, actor.employeeId);
    assert.equal(result.claim.finance!.reviewCycle, 1);
    assert.equal(result.claim.finance!.paidAt, undefined);
    assert.equal(
      result.claim.workflowHistory.at(-1)!.action,
      'FINANCE_VERIFIED',
    );
  });
for (const actor of [suresh, claimant])
  test(`${actor.name} cannot verify Finance`, () => {
    assert.throws(
      () => act(businessApproved(), actor, { action: 'FINANCE_VERIFIED' }),
      errorCode('FINANCE_ROLE_REQUIRED'),
    );
  });

test('Finance cannot verify with incomplete or old-cycle business approvals', () => {
  const approved = businessApproved();
  for (const approvals of [
    [],
    approved.claim.approvals.map((item) => ({ ...item, reviewCycle: 0 })),
  ]) {
    assert.throws(
      () =>
        act({ ...approved, claim: { ...approved.claim, approvals } }, ravi, {
          action: 'FINANCE_VERIFIED',
        }),
      errorCode('ACTION_NOT_ALLOWED'),
    );
  }
});

test('Finance return preserves verification history, and resubmit clears active Finance metadata', () => {
  let context = act(businessApproved(), ravi, { action: 'FINANCE_VERIFIED' });
  context = act(context, kavitha, {
    action: 'RETURNED',
    remarks: 'Correct supporting details',
  });
  assert.equal(context.claim.status, 'RETURNED');
  assert.equal(context.claim.approvals.length, 2);
  context = act(context, claimant, { action: 'RESUBMITTED' });
  assert.equal(context.claim.status, 'MANAGER_REVIEW');
  assert.equal(context.claim.finance, null);
  assert.ok(
    context.claim.workflowHistory.some(
      (item) => item.action === 'FINANCE_VERIFIED' && item.reviewCycle === 1,
    ),
  );
});

for (const date of ['2026-06-25', '2026-07-10'])
  test(`Finance may schedule the payment run ${date}`, () => {
    const verified = act(businessApproved(), ravi, {
      action: 'FINANCE_VERIFIED',
    });
    const scheduled = act(verified, kavitha, {
      action: 'PAYMENT_SCHEDULED',
      scheduledFor: date,
    });
    assert.equal(scheduled.claim.status, 'PAYMENT_SCHEDULED');
    assert.equal(scheduled.claim.finance!.paymentScheduledFor, date);
    assert.equal(
      scheduled.claim.finance!.paymentScheduledBy,
      kavitha.employeeId,
    );
  });
for (const date of ['2026-07-12', '2026-02-30', '2026-06-10', 'not-a-date'])
  test(`invalid payment date ${date} is rejected`, () => {
    const verified = act(businessApproved(), ravi, {
      action: 'FINANCE_VERIFIED',
    });
    assert.throws(
      () =>
        act(verified, ravi, {
          action: 'PAYMENT_SCHEDULED',
          scheduledFor: date,
        }),
      errorCode('INVALID_PAYMENT_DATE'),
    );
  });

test('payment scheduling requires Finance verification and cannot be invoked by another role', () => {
  const reviewed = businessApproved();
  assert.throws(
    () =>
      act(reviewed, ravi, {
        action: 'PAYMENT_SCHEDULED',
        scheduledFor: '2026-06-25',
      }),
    errorCode('ACTION_NOT_ALLOWED'),
  );
  assert.throws(
    () =>
      act(reviewed, suresh, {
        action: 'PAYMENT_SCHEDULED',
        scheduledFor: '2026-06-25',
      }),
    errorCode('FINANCE_ROLE_REQUIRED'),
  );
});

test('mark paid requires a reference and an arrived schedule, and records final audit metadata', () => {
  const verified = act(businessApproved(), ravi, {
    action: 'FINANCE_VERIFIED',
  });
  const scheduled = act(verified, ravi, {
    action: 'PAYMENT_SCHEDULED',
    scheduledFor: '2026-06-25',
  });
  assert.throws(
    () => act(scheduled, ravi, { action: 'PAID', paymentReference: ' ' }),
    errorCode('PAYMENT_REFERENCE_REQUIRED'),
  );
  assert.throws(
    () =>
      act(scheduled, ravi, {
        action: 'PAID',
        paymentReference: 'hypothetical-reference',
      }),
    errorCode('ACTION_NOT_ALLOWED'),
  );
  const paid = act(
    scheduled,
    kavitha,
    { action: 'PAID', paymentReference: ' hypothetical-reference ' },
    new Date('2026-06-25T10:00:00Z'),
  );
  assert.equal(paid.claim.status, 'PAID');
  assert.equal(paid.claim.finance!.paymentReference, 'hypothetical-reference');
  assert.equal(paid.claim.workflowHistory.at(-1)!.action, 'PAID');
  assert.throws(
    () => act(paid, kavitha, { action: 'PAID', paymentReference: 'again' }),
    errorCode('ACTION_NOT_ALLOWED'),
  );
});

for (const [amount, direction] of [
  [1500000, 'RECOVERABLE'],
  [2000000, 'ZERO'],
] as const)
  test(`${direction} settlement remains Finance-verified without a fake payment`, () => {
    const context = act(businessApproved(readyContext(amount)), ravi, {
      action: 'FINANCE_VERIFIED',
    });
    assert.equal(settlementDirection(context.policy), direction);
    assert.equal(context.claim.status, 'FINANCE_REVIEW');
    assert.throws(
      () =>
        act(context, ravi, {
          action: 'PAYMENT_SCHEDULED',
          scheduledFor: '2026-06-25',
        }),
      errorCode('ACTION_NOT_ALLOWED'),
    );
  });

test('changed policy input cannot reuse approvals but can be returned for correction', () => {
  const context = act(readyContext(), claimant, { action: 'SUBMITTED' });
  const changed = { ...context, policyInputHash: 'changed' };
  assert.throws(
    () => act(changed, suresh, { action: 'APPROVED' }),
    errorCode('CLAIM_STATE_CONFLICT'),
  );
  assert.equal(
    act(changed, suresh, { action: 'RETURNED', remarks: 'Contents changed' })
      .claim.status,
    'RETURNED',
  );
});

test('a changed assigned hierarchy cannot silently reuse the stored route', () => {
  const context = act(readyContext(), claimant, { action: 'SUBMITTED' });
  context.hierarchy = actors.map((item) =>
    item.employeeId === suresh.employeeId
      ? { ...item, organizationalRole: 'EMPLOYEE' }
      : item,
  );
  assert.throws(
    () => act(context, suresh, { action: 'APPROVED' }),
    errorCode('REQUIRED_APPROVER_NOT_FOUND'),
  );
});

test('duplicate current-cycle approval cannot append a second decision', () => {
  const context = act(readyContext(), claimant, { action: 'SUBMITTED' });
  const approval = planClaimTransition(
    context,
    suresh,
    { action: 'APPROVED' },
    actionTime,
  ).approval!;
  context.claim = { ...context.claim, approvals: [approval] };
  assert.throws(
    () => act(context, suresh, { action: 'APPROVED' }),
    errorCode('CLAIM_STATE_CONFLICT'),
  );
});

test('two concurrent real approve services produce one approval and one state conflict', async (t) => {
  t.after(() => mock.restoreAll());
  const database = mockDatabase();
  const id = database.claim._id.toString();
  await submitClaim(id, claimant);
  const results = await Promise.allSettled([
    approveClaim(id, suresh),
    approveClaim(id, suresh),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  const failed = results.find((item) => item.status === 'rejected');
  assert.ok(
    failed?.status === 'rejected' &&
      errorCode('CLAIM_STATE_CONFLICT')(failed.reason),
  );
  assert.equal(database.claim.status, 'HOD_REVIEW');
  assert.equal(database.claim.approvals.length, 1);
  assert.equal(database.claim.workflowHistory.length, 2);
  assert.deepEqual(database.writes[1]!.filter, database.writes[2]!.filter);
});

test('same-status concurrent Finance verification is protected by workflow version', async (t) => {
  t.after(() => mock.restoreAll());
  const database = mockDatabase();
  const id = database.claim._id.toString();
  await submitClaim(id, claimant);
  await approveClaim(id, suresh);
  await approveClaim(id, meera);
  const results = await Promise.allSettled([
    verifyClaimByFinance(id, ravi),
    verifyClaimByFinance(id, kavitha),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  const failed = results.find((item) => item.status === 'rejected');
  assert.ok(
    failed?.status === 'rejected' &&
      errorCode('CLAIM_STATE_CONFLICT')(failed.reason),
  );
  assert.equal(
    database.claim.workflowHistory.filter(
      (item) => item.action === 'FINANCE_VERIFIED',
    ).length,
    1,
  );
});

test('conditional write checks status, cycle and revision and appends audit atomically', () => {
  const context = readyContext();
  const plan = planClaimTransition(
    context,
    claimant,
    { action: 'SUBMITTED' },
    actionTime,
  );
  const { filter, update } = conditionalWorkflowWrite(context.claim, plan);
  assert.equal(filter.status, 'DRAFT');
  assert.deepEqual(filter.$and, [
    { $or: [{ reviewCycle: 0 }, { reviewCycle: { $exists: false } }] },
    { $or: [{ workflowVersion: 0 }, { workflowVersion: { $exists: false } }] },
  ]);
  assert.equal(update.$inc.workflowVersion, 1);
  assert.equal(update.$push.workflowHistory.action, 'SUBMITTED');
  assert.equal('workflowHistory' in update.$set, false);
});

test('persistence reports a lost conditional match instead of silently succeeding', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(Claim, 'findOneAndUpdate', () => query(() => null));
  const context = readyContext();
  await assert.rejects(
    persistWorkflowTransition(
      context.claim,
      planClaimTransition(
        context,
        claimant,
        { action: 'SUBMITTED' },
        actionTime,
      ),
    ),
    errorCode('CLAIM_STATE_CONFLICT'),
  );
});

test('claim model preserves seed defaults and validates workflow states and cycle integers offline', async () => {
  const data = canonicalDocuments();
  const claim = new Claim(data.claim);
  await claim.validate();
  assert.equal(claim.status, 'DRAFT');
  assert.equal(claim.reviewCycle, 0);
  assert.equal(claim.workflowVersion, 0);
  assert.deepEqual(claim.approvals.toObject(), []);
  assert.deepEqual(claim.workflowHistory.toObject(), []);
  assert.equal(claim.finance, null);
  assert.equal(claim.toObject().reviewInputHash, null);
  assert.equal(claimStatuses.includes('SUBMITTED' as never), false);
  for (const invalid of [
    { status: 'SUBMITTED' },
    { reviewCycle: -1 },
    { workflowVersion: 0.5 },
  ])
    await assert.rejects(new Claim({ ...data.claim, ...invalid }).validate());
});

test('policy assembler rejects broken references rather than evaluating a partial claim', () => {
  const data = canonicalDocuments();
  assert.throws(
    () =>
      assembleClaimPolicyInput(
        data.claim,
        data.travel,
        data.expenses.slice(1),
        data.evidence,
      ),
    errorCode('CLAIM_STATE_CONFLICT'),
  );
  assert.throws(
    () =>
      assembleClaimPolicyInput(
        { ...data.claim, employee: employees[7]!._id },
        data.travel,
        data.expenses,
        data.evidence,
      ),
    errorCode('CLAIM_STATE_CONFLICT'),
  );
});

test('workflow planning does not mutate its inputs or prior audit history', () => {
  const context = readyContext();
  const before = structuredClone(context);
  planClaimTransition(context, claimant, { action: 'SUBMITTED' }, actionTime);
  assert.deepEqual(context, before);
  assert.equal(
    workflowClaim(canonicalDocuments().claim).workflowHistory.length,
    0,
  );
});
test('non-review states reject approval and paid actions explicitly', () => {
  const context = readyContext();
  assert.throws(
    () => act(context, suresh, { action: 'APPROVED' }),
    errorCode('ACTION_NOT_ALLOWED'),
  );
  assert.throws(
    () => act(context, ravi, { action: 'PAID', paymentReference: 'fake' }),
    errorCode('ACTION_NOT_ALLOWED'),
  );
});

test('Finance service rejects a caller-supplied FINANCE role for Suresh', async (t) => {
  t.after(() => mock.restoreAll());
  const database = mockDatabase();
  const id = database.claim._id.toString();
  await submitClaim(id, claimant);
  await approveClaim(id, suresh);
  await approveClaim(id, meera);
  await assert.rejects(
    verifyClaimByFinance(id, { ...suresh, organizationalRole: 'FINANCE' }),
    errorCode('FINANCE_ROLE_REQUIRED'),
  );
  assert.equal(database.claim.finance ?? null, null);
});

test('return/resubmit services preserve old audit and persist validated cycle-two decisions', async (t) => {
  t.after(() => mock.restoreAll());
  const database = mockDatabase();
  const id = database.claim._id.toString();
  await submitClaim(id, claimant);
  await approveClaim(id, suresh);
  await returnClaim(id, meera, 'Please correct');
  await resubmitClaim(id, claimant);
  assert.equal(database.claim.status, 'MANAGER_REVIEW');
  assert.equal(database.claim.reviewCycle, 2);
  assert.equal(database.claim.approvals.length, 2);
  await approveClaim(id, suresh);
  await approveClaim(id, meera);
  await verifyClaimByFinance(id, ravi);
  assert.equal(
    database.claim.approvals.filter((item) => item.reviewCycle === 2).length,
    2,
  );
  await new Claim(database.claim).validate();
});

test('legacy drafts without workflow fields map to safe defaults without a migration', () => {
  const claim = canonicalDocuments().claim;
  for (const field of [
    'reviewCycle',
    'workflowVersion',
    'reviewRoute',
    'workflowHistory',
  ])
    Reflect.deleteProperty(claim, field);
  const context = workflowClaim(claim);
  assert.equal(context.reviewCycle, 0);
  assert.equal(context.workflowVersion, 0);
  assert.deepEqual(context.reviewRoute, []);
  assert.deepEqual(context.workflowHistory, []);
});

test('unknown claim IDs fail explicitly at the service boundary', async (t) => {
  t.after(() => mock.restoreAll());
  mockDatabase();
  await assert.rejects(
    submitClaim('not-an-object-id', claimant),
    errorCode('CLAIM_NOT_FOUND'),
  );
  mock.method(Claim, 'findById', () => query(() => null));
  await assert.rejects(
    submitClaim(canonicalDocuments().claim._id.toString(), claimant),
    errorCode('CLAIM_NOT_FOUND'),
  );
});

test('seed-default field updates clear stale Finance and review fingerprints', () => {
  const seed = canonicalDocuments().claim;
  const previous = {
    finance: { paymentReference: 'old-demo-payment' },
    reviewInputHash: 'old-review',
  };
  const reseeded = { ...previous, ...seed };
  assert.equal(reseeded.finance, null);
  assert.equal(reseeded.reviewInputHash, null);
  assert.equal(reseeded.reviewCycle, 0);
  assert.equal(reseeded.workflowHistory.length, 0);
});
