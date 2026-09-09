import { describe, it, expect, vi } from 'vitest';
import { toast } from 'sonner';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { DemoIdentityProvider } from '../context/DemoIdentityProvider';
import {
  initialClaim,
  initialValidation,
  initialReadiness,
  initialSettlement,
  claimId,
  claimExpenses,
} from './claimFixtures';
import type { Claim } from '../api/claimTypes';
import { people, trip, evidence } from './fixtures';
const envelope = (data: unknown) => Response.json({ data });
const failed = (code: string, message: string, status = 422) =>
  Response.json({ error: { code, message } }, { status });
function fresh(finance = false) {
  return structuredClone({
    claim: {
      ...initialClaim,
      status: (finance
        ? 'FINANCE_REVIEW'
        : 'MANAGER_REVIEW') as Claim['status'],
      reviewCycle: 1,
    },
    settlement: {
      ...initialSettlement,
      isFinal: true,
      payableMinor: 10000,
      recoverableMinor: 0,
    },
    listed: true,
  });
}
type State = ReturnType<typeof fresh>;
function setup(
  state = fresh(),
  finance = false,
  post?: (
    path: string,
    body: Record<string, unknown>,
  ) => Response | Promise<Response>,
  queueError?: Response,
) {
  const actor = finance
    ? 'NX-3305'
    : state.claim.status === 'HOD_REVIEW'
      ? 'NX-1108'
      : 'NX-2210';
  localStorage.setItem('ai-planet-demo-employee-code', actor);
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    if (path === '/demo/users') return envelope(people);
    const current = new Headers(options?.headers).get('X-Demo-Employee-Code');
    if (options?.method === 'POST')
      return post
        ? post(
            path,
            JSON.parse(String(options.body)) as Record<string, unknown>,
          )
        : failed('UNEXPECTED', 'Unexpected mutation');
    if (path === '/approvals' || path === '/finance/claims')
      return (
        queueError?.clone() ??
        envelope(current === actor && state.listed ? [state.claim] : [])
      );
    if (path === '/claims') return envelope(state.listed ? [state.claim] : []);
    if (path === '/travel-requests')
      return envelope(state.listed ? [trip] : []);
    if (path === `/claims/${claimId}`)
      return state.listed
        ? envelope(state.claim)
        : failed('FORBIDDEN', 'No longer assigned', 403);
    if (path === `/travel-requests/${trip.id}`) return envelope(trip);
    if (path.endsWith('/validation')) return envelope(initialValidation);
    if (path.endsWith('/readiness')) return envelope(initialReadiness);
    if (path.endsWith('/settlement')) return envelope(state.settlement);
    if (path.endsWith('/evidence')) return envelope(evidence);
    if (path.endsWith('/expenses')) return envelope(claimExpenses);
    if (path.startsWith('/evidence/'))
      return envelope(evidence.find((item) => path.endsWith(item.id)));
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  render(
    <MemoryRouter initialEntries={[finance ? '/finance' : '/approvals']}>
      <QueryClientProvider client={client}>
        <DemoIdentityProvider>
          <App />
        </DemoIdentityProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return fetcher;
}
async function select() {
  const button = await screen.findByRole(
    'button',
    {
      name: /Chaitanya Reddy.*14 expenses/,
    },
    { timeout: 3000 },
  );
  await userEvent.click(button);
  await screen.findByRole('heading', { name: 'Settlement summary' });
}
async function dialog(label: string) {
  await userEvent.click(screen.getByRole('button', { name: label }));
  return screen.getByRole('dialog', { name: label });
}
function result(
  state: State,
  action:
    'APPROVED' | 'RETURNED' | 'FINANCE_VERIFIED' | 'PAYMENT_SCHEDULED' | 'PAID',
  remarks: string | null = null,
) {
  return envelope({
    claimId,
    currentStatus: state.claim.status,
    reviewCycle: 1,
    workflowEvent: {
      action,
      fromStatus: 'MANAGER_REVIEW',
      toStatus: state.claim.status,
      actor: people[1]!.id,
      actorRole: 'REPORTING_MANAGER',
      occurredAt: '2026-09-09T10:00:00Z',
      remarks,
      reviewCycle: 1,
    },
  });
}
function verified(state: State) {
  state.claim.finance = {
    verifiedBy: people[3]!.id,
    verifiedAt: '2026-09-09T10:00:00Z',
    reviewCycle: 1,
    paymentScheduledFor: null,
    paymentScheduledBy: null,
    paidAt: null,
    paymentReference: null,
  };
}
describe('approval review workspace', () => {
  it('loads assigned context without employee editing controls', async () => {
    setup();
    await select();
    expect(screen.getByRole('button', { name: 'Approve claim' })).toBeEnabled();
    expect(
      screen.getByRole('heading', { name: 'Policy findings and evidence' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Submit claim' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Exclude from claim' }),
    ).not.toBeInTheDocument();
  });
  it('handles empty queues', async () => {
    const state = fresh();
    state.listed = false;
    setup(state);
    expect(
      await screen.findByRole('heading', { name: 'No claims in this queue' }),
    ).toBeVisible();
  });
  it('shows queue permission failures without actions', async () => {
    setup(fresh(), false, undefined, failed('FORBIDDEN', 'No access', 403));
    expect((await screen.findAllByText('No access')).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: 'Approve claim' }),
    ).not.toBeInTheDocument();
  });
  it('approves with optional blank remarks and clears a claim that leaves visibility', async () => {
    const state = fresh();
    const fetcher = setup(state, false, (_path, body) => {
      expect(body).toEqual({});
      state.listed = false;
      state.claim.status = 'HOD_REVIEW';
      return result(state, 'APPROVED');
    });
    await select();
    const form = await dialog('Approve claim');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Approve claim' }),
    );
    expect(
      await screen.findByText('This claim is no longer in your queue.'),
    ).toBeVisible();
    expect(screen.queryByText('No longer assigned')).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(1);
  });
  it('requires return remarks and sends trimmed remarks', async () => {
    const state = fresh();
    const post = vi.fn((_path: string, body: Record<string, unknown>) => {
      expect(body).toEqual({ remarks: 'Please attach proof' });
      state.listed = false;
      state.claim.status = 'RETURNED';
      return result(state, 'RETURNED', 'Please attach proof');
    });
    setup(state, false, post);
    await select();
    const form = await dialog('Return claim');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Return claim' }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(
      await within(form).findByText('Return remarks is required.'),
    ).toBeVisible();
    await userEvent.type(
      within(form).getByLabelText('Return remarks'),
      '  Please attach proof  ',
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Return claim' }),
    );
    expect(await screen.findByText('Decision recorded')).toBeVisible();
  });
  it.each([
    'CLAIM_STATE_CONFLICT',
    'NOT_REQUIRED_APPROVER',
    'SELF_APPROVAL_FORBIDDEN',
    'ACTION_NOT_ALLOWED',
  ])('handles %s without retrying mutation', async (code) => {
    const post = vi.fn(() =>
      failed(
        code,
        'Action rejected',
        code === 'CLAIM_STATE_CONFLICT' ? 409 : 403,
      ),
    );
    const fetcher = setup(fresh(), false, post);
    await select();
    const form = await dialog('Approve claim');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Approve claim' }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      code === 'CLAIM_STATE_CONFLICT' ? 'Claim changed' : 'Action rejected',
    );
    expect(post).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(([url]) =>
          url.endsWith(`/claims/${claimId}/settlement`),
        ).length,
      ).toBeGreaterThan(1),
    );
  });
  it('restores focus and scrolling after Escape', async () => {
    setup();
    await select();
    const button = screen.getByRole('button', { name: 'Approve claim' });
    await userEvent.click(button);
    expect(screen.getByLabelText('Remarks (optional)')).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('clears selected review when the persona changes', async () => {
    setup();
    await select();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'NX-1108');
    expect(
      await screen.findByRole('heading', { name: 'No claims in this queue' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Settlement summary' }),
    ).not.toBeInTheDocument();
  });
});
describe('Finance review workspace', () => {
  it('refreshes same-state verification metadata and hides repeated verify', async () => {
    const state = fresh(true);
    setup(state, true, (_path, body) => {
      expect(body).toEqual({});
      verified(state);
      return result(state, 'FINANCE_VERIFIED');
    });
    await select();
    const form = await dialog('Verify claim');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Verify claim' }),
    );
    expect(
      await screen.findByText('Verified for this review cycle.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Verify claim' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Schedule payment' }),
    ).toBeEnabled();
  });
  it.each([0, 10000])(
    'does not offer payment for a final nonpayable balance (%s recoverable)',
    async (recoverable) => {
      const state = fresh(true);
      verified(state);
      state.settlement.payableMinor = 0;
      state.settlement.recoverableMinor = recoverable;
      setup(state, true);
      await select();
      expect(screen.getByText(/No reimbursement payment is due/)).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Schedule payment' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Mark payment as completed' }),
      ).not.toBeInTheDocument();
    },
  );
  it('requires a valid calendar date then renders scheduled metadata', async () => {
    const state = fresh(true);
    verified(state);
    const post = vi.fn((_path: string, body: Record<string, unknown>) => {
      expect(body).toEqual({ scheduledFor: '2026-09-25' });
      state.claim.status = 'PAYMENT_SCHEDULED';
      state.claim.finance!.paymentScheduledFor = '2026-09-25';
      state.claim.finance!.paymentScheduledBy = people[3]!.id;
      return result(state, 'PAYMENT_SCHEDULED');
    });
    setup(state, true, post);
    await select();
    const form = await dialog('Schedule payment');
    const input = within(form).getByLabelText('Payment date');
    await userEvent.type(input, '2026-02-30');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Schedule payment' }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'valid date',
    );
    await userEvent.clear(input);
    await userEvent.type(input, '2026-09-25');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Schedule payment' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Mark payment as completed' }),
    ).toBeVisible();
  });
  it('shows invalid payment-run dates from the server inline', async () => {
    const state = fresh(true);
    verified(state);
    setup(state, true, () =>
      failed('INVALID_PAYMENT_DATE', 'Choose an allowed payment run'),
    );
    await select();
    const form = await dialog('Schedule payment');
    await userEvent.type(
      within(form).getByLabelText('Payment date'),
      '2026-09-11',
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Schedule payment' }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Choose an allowed payment run',
    );
  });
  it('requires a payment reference and shows paid metadata without more actions', async () => {
    const state = fresh(true);
    verified(state);
    state.claim.status = 'PAYMENT_SCHEDULED';
    state.claim.finance!.paymentScheduledFor = '2026-09-10';
    const post = vi.fn((_path: string, body: Record<string, unknown>) => {
      expect(body).toEqual({ paymentReference: 'BANK-123' });
      state.claim.status = 'PAID';
      state.claim.finance!.paymentReference = 'BANK-123';
      state.claim.finance!.paidAt = '2026-09-10T10:00:00Z';
      return result(state, 'PAID');
    });
    setup(state, true, post);
    await select();
    const form = await dialog('Mark payment as completed');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Mark payment as completed' }),
    );
    expect(post).not.toHaveBeenCalled();
    await userEvent.type(
      within(form).getByLabelText('Payment reference'),
      'BANK-123',
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Mark payment as completed' }),
    );
    expect(await screen.findByText('BANK-123')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Mark payment as completed' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Return claim' }),
    ).not.toBeInTheDocument();
  });
  it('lets Finance return using the shared endpoint', async () => {
    const state = fresh(true);
    setup(state, true, (path, body) => {
      expect(path).toBe(`/claims/${claimId}/return`);
      expect(body).toEqual({ remarks: 'Review proof' });
      state.listed = false;
      state.claim.status = 'RETURNED';
      return result(state, 'RETURNED');
    });
    await select();
    const form = await dialog('Return claim');
    await userEvent.type(
      within(form).getByLabelText('Return remarks'),
      'Review proof',
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Return claim' }),
    );
    expect(
      await screen.findByText('This claim is no longer in your queue.'),
    ).toBeVisible();
  });
});

describe('review action safeguards', () => {
  it('disables duplicate submissions while awaiting the server', async () => {
    let finish: ((response: Response) => void) | undefined;
    const state = fresh();
    const post = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    setup(state, false, post);
    await select();
    const form = await dialog('Approve claim');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Approve claim' }),
    );
    expect(
      await within(form).findByRole('button', { name: 'Updating...' }),
    ).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(form).toBeVisible();
    expect(post).toHaveBeenCalledTimes(1);
    finish!(result(state, 'APPROVED'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  it('does not treat an old-cycle verification as current', async () => {
    const state = fresh(true);
    verified(state);
    state.claim.finance!.reviewCycle = 0;
    setup(state, true);
    await select();
    expect(screen.getByRole('button', { name: 'Verify claim' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Schedule payment' }),
    ).not.toBeInTheDocument();
  });
  it.each(['PAYMENT_REFERENCE_REQUIRED', 'ACTION_NOT_ALLOWED'])(
    'shows mark-paid error %s without retry',
    async (code) => {
      const state = fresh(true);
      verified(state);
      state.claim.status = 'PAYMENT_SCHEDULED';
      state.claim.finance!.paymentScheduledFor = '2026-09-25';
      const post = vi.fn(() => failed(code, 'Payment cannot be completed yet'));
      setup(state, true, post);
      await select();
      const form = await dialog('Mark payment as completed');
      await userEvent.type(
        within(form).getByLabelText('Payment reference'),
        'BANK-123',
      );
      await userEvent.click(
        within(form).getByRole('button', { name: 'Mark payment as completed' }),
      );
      expect(await within(form).findByRole('alert')).toHaveTextContent(
        'Payment cannot be completed yet',
      );
      expect(post).toHaveBeenCalledTimes(1);
    },
  );
  it('shows Finance role rejection without local bypass', async () => {
    setup(
      fresh(true),
      true,
      undefined,
      failed('FINANCE_ROLE_REQUIRED', 'Finance identity required', 403),
    );
    expect(await screen.findByText('Finance identity required')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Verify claim' }),
    ).not.toBeInTheDocument();
  });
  it('preserves a conflict message after refreshed authorization removes a selection', async () => {
    const state = fresh();
    setup(state, false, () => {
      state.listed = false;
      return failed('CLAIM_STATE_CONFLICT', 'Changed', 409);
    });
    await select();
    const form = await dialog('Approve claim');
    await userEvent.click(
      within(form).getByRole('button', { name: 'Approve claim' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Claim changed');
  });
});

describe('returned actor-specific review states', () => {
  it('renders an HOD-stage assignment returned for Meera', async () => {
    const state = fresh();
    state.claim.status = 'HOD_REVIEW';
    setup(state);
    await select();
    expect(screen.getAllByText('Hod review').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Approve claim' })).toBeEnabled();
  });
  it('renders an empty Finance queue', async () => {
    const state = fresh(true);
    state.listed = false;
    setup(state, true);
    expect(
      await screen.findByRole('heading', { name: 'No claims in this queue' }),
    ).toBeVisible();
  });
  it('sends optional approval remarks and announces mutation success', async () => {
    const state = fresh();
    const success = vi.spyOn(toast, 'success');
    setup(state, false, (_path, body) => {
      expect(body).toEqual({ remarks: 'Evidence reviewed' });
      state.listed = false;
      state.claim.status = 'HOD_REVIEW';
      return result(state, 'APPROVED', 'Evidence reviewed');
    });
    await select();
    const form = await dialog('Approve claim');
    await userEvent.type(
      within(form).getByLabelText('Remarks (optional)'),
      'Evidence reviewed',
    );
    await userEvent.click(
      within(form).getByRole('button', { name: 'Approve claim' }),
    );
    expect(await screen.findByText('Decision recorded')).toBeVisible();
    expect(success).toHaveBeenCalledWith('Claim updated');
  });
});

it('shows policy rejection in review terms', async () => {
  setup(fresh(true), true, () => failed('POLICY_NOT_READY', 'Blocked'));
  await select();
  const form = await dialog('Verify claim');
  await userEvent.click(
    within(form).getByRole('button', { name: 'Verify claim' }),
  );
  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Claim is not ready for this action.',
  );
});
