import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { DemoIdentityProvider } from '../context/DemoIdentityProvider';
import { SettlementSummary } from '../components/claims/SettlementSummary';
import { people, trip, tripId, evidence } from './fixtures';
import {
  claimId,
  claimExpenses,
  dinner,
  hotelTax,
  initialClaim,
  initialValidation,
  initialReadiness,
  initialSettlement,
} from './claimFixtures';
import type { ClaimSettlement } from '../api/claimTypes';
const envelope = (data: unknown) => Response.json({ data });
const failure = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });
function fresh() {
  return structuredClone({
    claim: initialClaim,
    validation: initialValidation,
    readiness: initialReadiness,
    settlement: initialSettlement,
  });
}
type State = ReturnType<typeof fresh>;
function setup(
  state = fresh(),
  post?: (
    path: string,
    body: Record<string, unknown>,
  ) => Response | Promise<Response>,
  get?: (path: string) => Response | Promise<Response> | undefined,
) {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    if (path === '/demo/users') return envelope(people);
    const actor = new Headers(options?.headers).get('X-Demo-Employee-Code');
    if (actor !== 'NX-4471')
      return path === '/travel-requests' || path === '/claims'
        ? envelope([])
        : failure(
            'FORBIDDEN',
            'This claim is not available to your identity.',
            403,
          );
    if (options?.method === 'POST') {
      if (!post) throw new Error('Unexpected mutation');
      return post(
        path,
        options.body
          ? (JSON.parse(options.body as string) as Record<string, unknown>)
          : {},
      );
    }
    const override = get?.(path);
    if (override) return override;
    if (path === '/travel-requests') return envelope([trip]);
    if (path === '/claims') return envelope([state.claim]);
    if (path === `/claims/${claimId}`) return envelope(state.claim);
    if (path.endsWith('/validation')) return envelope(state.validation);
    if (path.endsWith('/readiness')) return envelope(state.readiness);
    if (path.endsWith('/settlement')) return envelope(state.settlement);
    if (path === `/travel-requests/${tripId}/expenses`)
      return envelope(claimExpenses);
    if (path === `/travel-requests/${tripId}/evidence`)
      return envelope(evidence);
    if (path.startsWith('/evidence/'))
      return envelope(evidence.find((item) => path.endsWith(item.id)));
    throw new Error(`Unexpected read ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  render(
    <MemoryRouter initialEntries={[`/claims/${claimId}`]}>
      <QueryClientProvider client={client}>
        <DemoIdentityProvider>
          <App />
        </DemoIdentityProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return fetcher;
}
async function readyPage() {
  await screen.findByRole('heading', { name: 'Settlement summary' });
}
function row(expense = dinner) {
  return screen.getByRole('listitem', {
    name: `${expense.merchant}: ${expense.description}`,
  });
}
async function excludeDialog() {
  await readyPage();
  const button = within(row()).getByRole('button', {
    name: 'Exclude from claim',
  });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  return screen.getByRole('dialog', { name: 'Exclude expense' });
}
async function resolveDialog() {
  await readyPage();
  const button = within(row(hotelTax)).getByRole('button', {
    name: 'Resolve hotel tax',
  });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  return screen.getByRole('dialog', { name: 'Resolve mixed hotel tax' });
}
async function allocation(dialog: HTMLElement, a: string, b: string) {
  await userEvent.type(within(dialog).getByLabelText('Reimbursable (INR)'), a);
  await userEvent.type(within(dialog).getByLabelText('Disallowed (INR)'), b);
  await userEvent.type(
    within(dialog).getByLabelText('Resolution reason'),
    'Hypothetical allocation after reviewing source evidence',
  );
}
function excluded(state: State) {
  state.claim.expenseReviews = [
    {
      expense: dinner.id,
      included: false,
      exclusionReason: 'Missing dinner supporting details',
      manualResolution: null,
      updatedBy: people[0]!.id,
      updatedAt: '2026-06-21T10:00:00Z',
    },
  ];
  state.claim.expenseReviewHistory = [
    {
      action: 'EXCLUDED',
      expense: dinner.id,
      actor: people[0]!.id,
      occurredAt: '2026-06-21T10:00:00Z',
      reason: 'Missing dinner supporting details',
      resolution: null,
    },
  ];
  state.validation.expenseResults = state.validation.expenseResults.map(
    (item) =>
      item.expenseKey === dinner.id
        ? {
            ...item,
            status: 'EXCLUDED',
            unresolvedMinor: 0,
            excludedMinor: 225500,
            findings: [],
          }
        : item,
  );
  state.validation.findings = state.validation.findings.filter(
    (item) => item.expenseKey !== dinner.id,
  );
  state.readiness.blockingIssues = state.readiness.blockingIssues.filter(
    (item) => item.expenseKey !== dinner.id,
  );
  state.settlement = {
    ...state.settlement,
    unresolvedMinor: 230400,
    excludedMinor: 225500,
  };
}
function makeReady(state: State) {
  state.readiness = {
    ...state.readiness,
    isReadyToSubmit: true,
    blockingIssues: [],
  };
  state.settlement = {
    ...state.settlement,
    isFinal: true,
    unresolvedMinor: 0,
    payableMinor: 292904,
    recoverableMinor: 0,
  };
}
describe('claim workspace', () => {
  it('shows the untouched draft with backend amounts and blocking findings', async () => {
    setup();
    await readyPage();
    expect(screen.getAllByText('Not ready to submit').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('₹4,559.00')).toBeVisible();
    expect(screen.getAllByText('Pending resolution')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
    expect(
      screen.getAllByText('Dinner attendee names are missing.').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('listitem', { name: /Normalized expense/ }),
    ).toHaveLength(14);
    expect(screen.getAllByText('Historical exception').length).toBeGreaterThan(
      0,
    );
  });
  it('keeps company-paid expenses visible without employee edit actions', async () => {
    setup();
    await readyPage();
    const flight = row(claimExpenses[0]!);
    expect(within(flight).getAllByText('Company paid')[0]).toBeVisible();
    expect(
      within(flight).queryByRole('button', { name: 'Exclude from claim' }),
    ).not.toBeInTheDocument();
  });
  it('opens the existing EvidenceDrawer from an expense', async () => {
    setup();
    await readyPage();
    await userEvent.click(
      within(row()).getAllByRole('button', {
        name: evidence[10]!.sourceFilename,
      })[0]!,
    );
    expect(
      await within(
        screen.getByRole('dialog', { name: 'Evidence detail' }),
      ).findByText('Dinner at Spice Terrace'),
    ).toBeVisible();
  });
  it('handles a claim 404 without rendering stale financial content', async () => {
    setup(fresh(), undefined, (path) =>
      path === `/claims/${claimId}`
        ? failure('NOT_FOUND', 'Claim not found.', 404)
        : undefined,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Claim not found.',
    );
    expect(
      screen.queryByRole('heading', { name: 'Settlement summary' }),
    ).not.toBeInTheDocument();
  });
  it('keeps the shell while claim data loads', async () => {
    setup(fresh(), undefined, (path) =>
      path === `/claims/${claimId}`
        ? new Promise<Response>(() => {})
        : undefined,
    );
    expect(
      screen.getByRole('heading', { name: 'Expense Claim' }),
    ).toBeVisible();
    await screen.findByRole('option', { name: /Chaitanya/ });
    expect(screen.getByText('Loading…')).toBeVisible();
  });
  it('does not show another actor the cached claimant workspace', async () => {
    setup();
    await readyPage();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Demo identity' }),
      'NX-2210',
    );
    expect(
      screen.queryByRole('heading', { name: 'Settlement summary' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This claim is not available to your identity.',
    );
  });
  for (const status of [
    'MANAGER_REVIEW',
    'HOD_REVIEW',
    'DIVISION_REVIEW',
    'MD_REVIEW',
    'FINANCE_REVIEW',
    'PAYMENT_SCHEDULED',
    'PAID',
  ] as const)
    it(`makes ${status} read-only`, async () => {
      const state = fresh();
      state.claim.status = status;
      setup(state);
      await readyPage();
      expect(
        screen.queryByRole('button', { name: 'Exclude from claim' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Submit claim' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/This claim is read-only/)).toBeVisible();
    });
});
describe('expense decisions', () => {
  it('requires an exclusion reason without sending a request', async () => {
    const fetcher = setup();
    const dialog = await excludeDialog();
    expect(within(dialog).getByLabelText('Exclusion reason')).toHaveValue('');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Exclude from claim' }),
    );
    expect(
      await within(dialog).findByText('A reason is required.'),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.some(([, options]) => options?.method === 'POST'),
    ).toBe(false);
  });
  it('excludes, refetches all affected reads and retains the source row and history', async () => {
    const state = fresh();
    const fetcher = setup(state, () => {
      excluded(state);
      return envelope(state.claim);
    });
    const dialog = await excludeDialog();
    await userEvent.type(
      within(dialog).getByLabelText('Exclusion reason'),
      'Missing dinner supporting details',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Exclude from claim' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(within(row()).getAllByText('Excluded').length).toBeGreaterThan(0);
    expect(within(row()).getByText('₹2,255.00')).toBeVisible();
    expect(within(row()).getByText('Expense review history (1)')).toBeVisible();
    expect(await screen.findByText('Expense excluded')).toBeInTheDocument();
    for (const suffix of ['', '/validation', '/readiness', '/settlement'])
      expect(
        fetcher.mock.calls.filter(
          ([url, options]) =>
            url.endsWith(`/claims/${claimId}${suffix}`) &&
            options?.method === 'GET',
        ).length,
      ).toBeGreaterThanOrEqual(2);
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith('/claims')).length,
    ).toBeGreaterThanOrEqual(2);
  });
  it('restores from server results and retains previous audit history', async () => {
    const state = fresh();
    excluded(state);
    setup(state, () => {
      state.claim.expenseReviews[0]!.included = true;
      state.claim.expenseReviews[0]!.exclusionReason = null;
      state.claim.expenseReviewHistory.push({
        action: 'RESTORED',
        expense: dinner.id,
        actor: people[0]!.id,
        occurredAt: '2026-06-21T11:00:00Z',
        reason: null,
        resolution: null,
      });
      state.validation = structuredClone(initialValidation);
      state.readiness = structuredClone(initialReadiness);
      state.settlement = structuredClone(initialSettlement);
      return envelope(state.claim);
    });
    await readyPage();
    const button = within(row()).getByRole('button', {
      name: 'Restore to claim',
    });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() =>
      expect(within(row()).getByText('Included')).toBeVisible(),
    );
    expect(within(row()).getByText('Expense review history (2)')).toBeVisible();
    expect(within(row()).getByText('₹2,255.00')).toBeVisible();
  });
  it('closes on Escape and restores focus to the opener', async () => {
    setup();
    const dialog = await excludeDialog();
    expect(within(dialog).getByLabelText('Exclusion reason')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      within(row()).getByRole('button', { name: 'Exclude from claim' }),
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
  it('blocks repeat clicks and hides financial panels until authoritative refetch completes', async () => {
    const state = fresh();
    let complete: ((value: Response) => void) | undefined;
    const fetcher = setup(
      state,
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const dialog = await excludeDialog();
    await userEvent.type(
      within(dialog).getByLabelText('Exclusion reason'),
      'Missing support',
    );
    await userEvent.dblClick(
      within(dialog).getByRole('button', { name: 'Exclude from claim' }),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('heading', { name: 'Settlement summary' }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
    excluded(state);
    complete!(envelope(state.claim));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole('heading', { name: 'Settlement summary' }),
    ).toBeVisible();
  });
});
describe('hotel tax resolution', () => {
  it('sends only the explicit hypothetical allocation and reason', async () => {
    const state = fresh();
    let request: Record<string, unknown> | undefined;
    setup(state, (_path, body) => {
      request = body;
      state.claim.expenseReviews = [
        {
          expense: hotelTax.id,
          included: true,
          exclusionReason: null,
          manualResolution: {
            reimbursableMinor: 100000,
            disallowedMinor: 130400,
            reason: String(body.reason),
          },
          updatedBy: people[0]!.id,
          updatedAt: null,
        },
      ];
      return envelope(state.claim);
    });
    const dialog = await resolveDialog();
    expect(within(dialog).getByLabelText('Reimbursable (INR)')).toHaveValue('');
    expect(within(dialog).getByLabelText('Disallowed (INR)')).toHaveValue('');
    await allocation(dialog, '1000.00', '1304.00');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save resolution' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(request).toEqual({
      reimbursableMinor: 100000,
      disallowedMinor: 130400,
      reason: 'Hypothetical allocation after reviewing source evidence',
    });
    expect(within(row(hotelTax)).getByText('₹2,304.00')).toBeVisible();
    expect(
      within(row(hotelTax)).getByText(/Recorded allocation/),
    ).toBeVisible();
  });
  it.each([
    ['1000', '1200', 'Both allocations must total the source amount.'],
    [
      '-1',
      '2305',
      'Enter a non-negative amount with at most two decimal places.',
    ],
    [
      '1.001',
      '2303',
      'Enter a non-negative amount with at most two decimal places.',
    ],
  ])('rejects invalid allocation %s / %s', async (a, b, message) => {
    const fetcher = setup();
    const dialog = await resolveDialog();
    await allocation(dialog, a, b);
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save resolution' }),
    );
    expect(await within(dialog).findByText(message)).toBeVisible();
    expect(
      fetcher.mock.calls.some(([, options]) => options?.method === 'POST'),
    ).toBe(false);
  });
  it('keeps server 422 feedback inline and preserves form input', async () => {
    setup(fresh(), () =>
      failure(
        'INVALID_MANUAL_RESOLUTION',
        'The allocation is no longer valid.',
        422,
      ),
    );
    const dialog = await resolveDialog();
    await allocation(dialog, '1000', '1304');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save resolution' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The allocation is no longer valid.',
    );
    expect(within(dialog).getByLabelText('Reimbursable (INR)')).toHaveValue(
      '1000',
    );
  });
});
describe('settlement values', () => {
  it('preserves null payable and recoverable as unknown', () => {
    render(<SettlementSummary settlement={initialSettlement} />);
    expect(screen.getAllByText('Pending resolution')).toHaveLength(2);
    expect(
      screen.getByText('Payable to employee').parentElement,
    ).not.toHaveTextContent('₹0.00');
  });
  for (const [name, payableMinor, recoverableMinor] of [
    ['payable', 292904, 0],
    ['recoverable', 0, 45200],
    ['zero', 0, 0],
  ] as const)
    it(`renders a backend final ${name} settlement`, () => {
      const settlement: ClaimSettlement = {
        ...initialSettlement,
        isFinal: true,
        payableMinor,
        recoverableMinor,
      };
      render(<SettlementSummary settlement={settlement} />);
      expect(screen.getByText('Final calculation')).toBeVisible();
      expect(screen.queryByText('Pending resolution')).not.toBeInTheDocument();
      if (name === 'payable')
        expect(screen.getByText('₹2,929.04')).toBeVisible();
      if (name === 'recoverable')
        expect(screen.getByText('₹452.00')).toBeVisible();
      if (name === 'zero')
        expect(
          screen.getByText('No balance payable or recoverable.'),
        ).toBeVisible();
    });
});
describe('submission and conflict recovery', () => {
  it('submits a ready claim with no client-selected route and renders refetched status', async () => {
    const state = fresh();
    makeReady(state);
    const fetcher = setup(state, () => {
      state.claim.status = 'MANAGER_REVIEW';
      state.claim.reviewCycle = 1;
      return envelope({ claimId, currentStatus: 'MANAGER_REVIEW' });
    });
    await readyPage();
    const button = screen.getByRole('button', { name: 'Submit claim' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Submit claim' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Manager review')).toBeVisible();
    const request = fetcher.mock.calls.find(
      ([, options]) => options?.method === 'POST',
    )!;
    expect(request[0]).toContain('/submit');
    expect(request[1]?.body).toBeUndefined();
  });
  it('handles stale POLICY_NOT_READY by refreshing blockers', async () => {
    const state = fresh();
    makeReady(state);
    setup(state, () => {
      state.readiness = structuredClone(initialReadiness);
      return failure('POLICY_NOT_READY', 'Claim is not ready to submit.', 422);
    });
    await readyPage();
    const button = screen.getByRole('button', { name: 'Submit claim' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Review the refreshed blocking findings',
    );
    expect(screen.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
  });
  it('shows return remarks, allows editing and resubmits into a new server review cycle', async () => {
    const state = fresh();
    makeReady(state);
    state.claim.status = 'RETURNED';
    state.claim.reviewCycle = 1;
    state.claim.workflowHistory = [
      {
        action: 'RETURNED',
        actor: people[1]!.id,
        actorRole: 'REPORTING_MANAGER',
        fromStatus: 'MANAGER_REVIEW',
        toStatus: 'RETURNED',
        reviewCycle: 1,
        occurredAt: '2026-06-22T10:00:00Z',
        remarks: 'Please clarify the tax allocation.',
      },
    ];
    state.claim.approvals = [
      {
        level: 'REPORTING_MANAGER',
        approver: people[1]!.id,
        decision: 'RETURNED',
        decidedAt: '2026-06-22T10:00:00Z',
        remarks: 'Please clarify the tax allocation.',
        reviewCycle: 1,
      },
    ];
    const fetcher = setup(state, () => {
      state.claim.status = 'MANAGER_REVIEW';
      state.claim.reviewCycle = 2;
      state.claim.workflowHistory.push({
        action: 'RESUBMITTED',
        actor: people[0]!.id,
        actorRole: 'EMPLOYEE',
        fromStatus: 'RETURNED',
        toStatus: 'MANAGER_REVIEW',
        reviewCycle: 2,
        occurredAt: '2026-06-23T10:00:00Z',
        remarks: null,
      });
      return envelope({ claimId, currentStatus: 'MANAGER_REVIEW' });
    });
    await readyPage();
    expect(screen.getByText('Latest return remarks')).toBeVisible();
    expect(
      screen.getAllByText('Please clarify the tax allocation.').length,
    ).toBeGreaterThan(0);
    expect(
      within(row()).getByRole('button', { name: 'Exclude from claim' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit claim' }),
    ).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Resubmit claim' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(await screen.findByText('Review cycle 2')).toBeVisible();
    expect(screen.getByText('Review cycle 1')).toBeVisible();
    expect(
      fetcher.mock.calls.find(([, options]) => options?.method === 'POST')![0],
    ).toContain('/resubmit');
  });
  it('refetches on 409 without retrying the financial mutation', async () => {
    const state = fresh();
    const fetcher = setup(state, () => {
      state.settlement = {
        ...state.settlement,
        unresolvedMinor: 230400,
        excludedMinor: 225500,
      };
      return failure('CLAIM_STATE_CONFLICT', 'Stale write.', 409);
    });
    const dialog = await excludeDialog();
    await userEvent.type(
      within(dialog).getByLabelText('Exclusion reason'),
      'Missing support',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Exclude from claim' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Claim changed while you were reviewing it',
    );
    expect(
      await screen.findByText('₹2,304.00', { selector: 'dd' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('₹4,559.00')).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });
});

describe('financial refresh failure', () => {
  it('does not retain stale settlement amounts when a post-mutation read fails', async () => {
    const state = fresh();
    let failSettlement = false;
    setup(
      state,
      () => {
        excluded(state);
        failSettlement = true;
        return envelope(state.claim);
      },
      (path) =>
        failSettlement && path.endsWith('/settlement')
          ? failure('UNAVAILABLE', 'Latest settlement unavailable.', 500)
          : undefined,
    );
    const dialog = await excludeDialog();
    await userEvent.type(
      within(dialog).getByLabelText('Exclusion reason'),
      'Missing source details',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Exclude from claim' }),
    );
    expect(
      await screen.findByText('Latest settlement unavailable.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Settlement summary' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('₹4,559.00')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
  });
});

describe('readiness is separate from settlement finality', () => {
  it('renders final financial values without enabling a blocked submission', async () => {
    const state = fresh();
    state.settlement = {
      ...state.settlement,
      isFinal: true,
      payableMinor: 10000,
      recoverableMinor: 0,
    };
    setup(state);
    await readyPage();
    expect(screen.getByText('Final calculation')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
  });
  it('uses the readiness response rather than inferring it from isFinal', async () => {
    const state = fresh();
    state.readiness = {
      ...state.readiness,
      isReadyToSubmit: true,
      blockingIssues: [],
    };
    setup(state);
    await readyPage();
    expect(screen.getByText('Provisional · not final')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Submit claim' }),
      ).toBeEnabled(),
    );
  });
});
