import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { DemoIdentityProvider } from '../context/DemoIdentityProvider';
import { tripId, trip, people, evidence, expenses, claims } from './fixtures';
import { classificationLabels } from '../components/evidencePresentation';
function response(data: unknown) {
  return Response.json({ data });
}
function mockApi(
  override?: (
    path: string,
    actor: string | null,
  ) => Response | Promise<Response> | undefined,
) {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    const path = new URL(url).pathname.replace('/api/v1', '');
    const actor = new Headers(options?.headers).get('X-Demo-Employee-Code');
    const custom = override?.(path, actor);
    if (custom) return custom;
    if (path === '/demo/users') return response(people);
    if (actor !== 'NX-4471')
      return path === '/travel-requests' || path === '/claims'
        ? response([])
        : Response.json(
            {
              error: {
                code: 'FORBIDDEN',
                message: 'You cannot access this trip.',
              },
            },
            { status: 403 },
          );
    if (path === '/travel-requests') return response([trip]);
    if (path === `/travel-requests/${tripId}`) return response(trip);
    if (path.endsWith('/evidence') && path.startsWith('/travel-requests'))
      return response(evidence);
    if (path.endsWith('/expenses')) return response(expenses);
    if (path === '/claims') return response(claims);
    if (path.startsWith('/evidence/'))
      return response(evidence.find((item) => path.endsWith(item.id)));
    throw new Error(`Unexpected read: ${path}`);
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
function mount(path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <DemoIdentityProvider>
          <App />
        </DemoIdentityProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
describe('employee dashboard', () => {
  it('renders API travel, money, dates, claim and contextual navigation', async () => {
    mockApi();
    mount();
    expect(await screen.findByText('Pune → Bengaluru')).toBeVisible();
    expect(screen.getByText('₹48,000.00')).toBeVisible();
    expect(screen.getByText('₹20,000.00')).toBeVisible();
    expect(screen.getByText(/16 Jun 2026 – 20 Jun 2026/)).toBeVisible();
    expect(await screen.findByText('Draft')).toBeVisible();
    expect(await screen.findByText('₹27,318.04')).toBeVisible();
    expect(screen.getByText('₹10,556.00')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review claim' })).toHaveAttribute(
      'href',
      `/claims/${claims[0]!.id}`,
    );
    expect(screen.getByRole('link', { name: 'Open trip' })).toHaveAttribute(
      'href',
      `/trips/${tripId}`,
    );
    expect(screen.getByRole('link', { name: 'Trip request' })).toHaveAttribute(
      'href',
      `/trips/${tripId}`,
    );
    expect(
      await screen.findByText(
        '17 evidence records · 15 emails · 2 receipt attachments',
      ),
    ).toBeVisible();
  });
  it('uses response amounts instead of canonical constants', async () => {
    mockApi((path) =>
      path === '/travel-requests'
        ? response([
            {
              ...trip,
              estimatedSpendMinor: 123456,
              advanceDisbursedMinor: 50000,
            },
          ])
        : undefined,
    );
    mount();
    expect(await screen.findByText('₹1,234.56')).toBeVisible();
    expect(screen.getByText('₹500.00')).toBeVisible();
    expect(screen.queryByText('₹48,000.00')).not.toBeInTheDocument();
  });
  it('renders more than one trip', async () => {
    mockApi((path) =>
      path === '/travel-requests'
        ? response([
            trip,
            { ...trip, id: 'cccccccccccccccccccccccc', destination: 'Delhi' },
          ])
        : undefined,
    );
    mount();
    expect(await screen.findByText('Pune → Delhi')).toBeVisible();
    expect(screen.getByText('Pune → Bengaluru')).toBeVisible();
  });
  it('shows an empty travel state', async () => {
    mockApi((path) => (path === '/travel-requests' ? response([]) : undefined));
    mount();
    expect(await screen.findByText('No travel requests')).toBeVisible();
  });
  it('keeps the shell during loading', async () => {
    mockApi((path) =>
      path === '/travel-requests' ? new Promise<Response>(() => {}) : undefined,
    );
    mount();
    await screen.findByRole('option', { name: /Chaitanya/ });
    expect(screen.getByText('Loading…')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
  it('shows an API error and retry', async () => {
    mockApi((path) =>
      path === '/travel-requests'
        ? Response.json(
            {
              error: {
                code: 'FAILED',
                message: 'Travel temporarily unavailable',
              },
            },
            { status: 500 },
          )
        : undefined,
    );
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Travel temporarily unavailable',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
  it('shows no related claim without inventing a link', async () => {
    mockApi((path) => (path === '/claims' ? response([]) : undefined));
    mount();
    expect(await screen.findByText('No related claim')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Review claim' }),
    ).not.toBeInTheDocument();
  });
  it('clears trip data for each switched persona', async () => {
    mockApi();
    mount();
    await screen.findByText('Pune → Bengaluru');
    for (const code of ['NX-2210', 'NX-1108', 'NX-3305']) {
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Demo identity' }),
        code,
      );
      expect(screen.queryByText('Pune → Bengaluru')).not.toBeInTheDocument();
      expect(await screen.findByText('No travel requests')).toBeVisible();
    }
  });
});
describe('trip overview', () => {
  it('uses Mongo route ID while preserving unknown business ID and source approvals', async () => {
    const fetcher = mockApi();
    mount(`/trips/${tripId}`);
    expect(
      await screen.findByText('Unknown / Needs confirmation'),
    ).toBeVisible();
    expect(screen.getByText('₹48,000.00')).toBeVisible();
    expect(screen.getAllByText('₹20,000.00')).toHaveLength(2);
    expect(screen.getByText('Approved')).toBeVisible();
    expect(screen.getByText(/Reporting manager ·/)).toBeVisible();
    expect(
      screen.getByText(
        'No HOD pre-travel approval is established by the supplied sources.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Fully approved')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Review evidence' }),
    ).toHaveAttribute('href', `/trips/${tripId}/evidence`);
    expect(
      fetcher.mock.calls.some(([url]) =>
        url.endsWith(`/travel-requests/${tripId}`),
      ),
    ).toBe(true);
  });
  it('shows all normalized source expenses and separates payer totals', async () => {
    mockApi();
    mount(`/trips/${tripId}`);
    expect(await screen.findByText('₹27,318.04')).toBeVisible();
    expect(screen.getByText('₹10,556.00')).toBeVisible();
    expect(screen.getAllByText(/^Normalized expense \d+$/)).toHaveLength(14);
    expect(screen.getAllByText('Company paid')).toHaveLength(2);
  });
  it('shows empty expenses', async () => {
    mockApi((path) => (path.endsWith('/expenses') ? response([]) : undefined));
    mount(`/trips/${tripId}`);
    expect(await screen.findByText('No expenses')).toBeVisible();
  });
  it('opens historical approval evidence', async () => {
    mockApi();
    mount(`/trips/${tripId}`);
    await userEvent.click(
      await screen.findByRole('button', { name: 'View approval email' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Manager approval')).toBeVisible();
  });
  it('shows forbidden after identity switch on an existing trip route', async () => {
    mockApi();
    mount(`/trips/${tripId}`);
    await screen.findByText('Pune → Bengaluru');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Demo identity' }),
      'NX-2210',
    );
    expect(screen.queryByText('Pune → Bengaluru')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot access this trip.',
    );
  });
});
describe('evidence workspace', () => {
  const path = `/trips/${tripId}/evidence`;
  it('retains all seventeen sources and every important classification', async () => {
    mockApi();
    mount(path);
    const list = await screen.findByRole('list', { name: 'Evidence records' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(17);
    for (const value of [
      'PAYMENT_FAILURE',
      'DUPLICATE',
      'CLAIMANT_MISMATCH',
      'NOISE',
      'COMPANY_PAID_COST',
      'NEEDS_REVIEW',
    ] as const)
      expect(
        within(list).getAllByText(classificationLabels[value]).length,
      ).toBeGreaterThan(0);
  });
  it('filters classification, searches loaded source fields and resets all filters', async () => {
    mockApi();
    mount(path);
    await screen.findByRole('list', { name: 'Evidence records' });
    await userEvent.selectOptions(
      screen.getByLabelText('Classification'),
      'NEEDS_REVIEW',
    );
    expect(screen.getByText('Showing 2 of 17 evidence records')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Search evidence'), 'Spice');
    expect(screen.getByText('Showing 1 of 17 evidence records')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset filters' }),
    );
    expect(screen.getByText('Showing 17 of 17 evidence records')).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'IMAGE');
    expect(screen.getByText('Showing 2 of 17 evidence records')).toBeVisible();
  });
  it('shows no matching records and recovers on reset', async () => {
    mockApi();
    mount(path);
    await screen.findByRole('list', { name: 'Evidence records' });
    await userEvent.type(
      screen.getByLabelText('Search evidence'),
      'no such source',
    );
    expect(screen.getByText('No matching evidence')).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset filters' }),
    );
    expect(screen.getByText('Showing 17 of 17 evidence records')).toBeVisible();
  });
  it('shows empty evidence', async () => {
    mockApi((url) => (url.endsWith('/evidence') ? response([]) : undefined));
    mount(path);
    expect(await screen.findByText('No evidence')).toBeVisible();
  });
  it('loads email detail as text, closes on Escape and restores focus/scroll', async () => {
    mockApi();
    mount(path);
    const opener = await screen.findByRole('button', {
      name: 'Inspect Uber payment failed',
    });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Evidence detail' });
    expect(
      await within(dialog).findByText(/Source text for Uber payment failed/),
    ).toBeVisible();
    expect(dialog.querySelector('script')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close evidence' }),
    );
    expect(opener).toHaveFocus();
    await userEvent.click(opener);
    within(screen.getByRole('dialog'))
      .getByRole('button', { name: 'Close evidence' })
      .focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
  it('follows related evidence and displays linked expenses', async () => {
    mockApi();
    mount(path);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Inspect Uber payment failed',
      }),
    );
    const dialog = screen.getByRole('dialog');
    await userEvent.click(
      await within(dialog).findByRole('button', {
        name: 'Resolved by: Uber successful payment',
      }),
    );
    expect(
      await within(dialog).findByText('Uber successful payment'),
    ).toBeVisible();
    expect(
      await within(dialog).findByText('Normalized expense 5'),
    ).toBeVisible();
  });
  it('shows receipt metadata without broken image markup', async () => {
    mockApi();
    mount(path);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Inspect Dinner receipt image',
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Receipt details')).toBeVisible();
    expect(within(dialog).getByText('Vertex procurement team')).toBeVisible();
    expect(within(dialog).getByText('4')).toBeVisible();
    expect(within(dialog).queryByRole('img')).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/Image preview is not available/),
    ).toBeVisible();
  });
  it('shows a detail loading state', async () => {
    mockApi((url) =>
      url.startsWith('/evidence/')
        ? new Promise<Response>(() => {})
        : undefined,
    );
    mount(path);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Inspect Travel request' }),
    );
    expect(
      within(screen.getByRole('dialog')).getByText('Loading…'),
    ).toBeVisible();
  });
  it('shows a controlled detail error', async () => {
    mockApi((url) =>
      url.startsWith('/evidence/')
        ? Response.json(
            { error: { code: 'NOT_FOUND', message: 'Evidence not found' } },
            { status: 404 },
          )
        : undefined,
    );
    mount(path);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Inspect Travel request' }),
    );
    expect(
      await within(screen.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent('Evidence not found');
  });
  it('removes evidence and an open drawer when the identity changes', async () => {
    mockApi();
    mount(path);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Inspect Travel request' }),
    );
    expect(screen.getByRole('dialog')).toBeVisible();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Demo identity' }),
      'NX-2210',
    );
    expect(
      screen.queryByRole('list', { name: 'Evidence records' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You cannot access this trip.',
    );
    await waitFor(() =>
      expect(screen.queryByText('Uber payment failed')).not.toBeInTheDocument(),
    );
  });
});
