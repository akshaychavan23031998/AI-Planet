import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import App from '../App';
import { DemoIdentityProvider } from '../context/DemoIdentityProvider';
import { identityStorageKey, useDemoIdentity } from '../context/demoIdentity';
import { ErrorState } from '../components/ui';
import { NetworkError } from '../api/errors';

const people = [
  {
    id: '111111111111111111111111',
    employeeCode: 'NX-4471',
    name: 'Chaitanya Reddy',
    organizationalRole: 'EMPLOYEE',
  },
  {
    id: '222222222222222222222222',
    employeeCode: 'NX-2210',
    name: 'Suresh Iyer',
    organizationalRole: 'REPORTING_MANAGER',
  },
];
function respond(users = people) {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({ data: users, meta: { count: users.length } }),
        ),
      ),
  );
}
function Probe() {
  const identity = useDemoIdentity();
  return (
    <>
      <output aria-label="Selected person">
        {identity.selectedEmployeeCode}
      </output>
      <button onClick={() => identity.setSelectedEmployeeCode('NX-2210')}>
        Switch person
      </button>
    </>
  );
}
function mount(children: ReactNode = <App />, path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <DemoIdentityProvider>{children}</DemoIdentityProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
describe('demo identity', () => {
  it('loads users and selects the canonical persona by default', async () => {
    respond();
    mount(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Selected person')).toHaveTextContent(
        'NX-4471',
      ),
    );
    expect(localStorage.getItem(identityStorageKey)).toBe('NX-4471');
  });
  it('restores a valid persisted employee code', async () => {
    localStorage.setItem(identityStorageKey, 'NX-2210');
    respond();
    mount(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Selected person')).toHaveTextContent(
        'NX-2210',
      ),
    );
  });
  it('replaces an invalid persisted code with the canonical persona', async () => {
    localStorage.setItem(identityStorageKey, 'NX-9999');
    respond();
    mount(<Probe />);
    await waitFor(() =>
      expect(localStorage.getItem(identityStorageKey)).toBe('NX-4471'),
    );
  });
  it('falls back to the first returned user if the canonical persona is absent', async () => {
    respond([people[1]!]);
    mount(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Selected person')).toHaveTextContent(
        'NX-2210',
      ),
    );
  });
  it('switches context and stores only the employee code', async () => {
    respond();
    mount(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Selected person')).toHaveTextContent(
        'NX-4471',
      ),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Switch person' }),
    );
    expect(screen.getByLabelText('Selected person')).toHaveTextContent(
      'NX-2210',
    );
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(identityStorageKey)).toBe('NX-2210');
  });
  it('continues to work when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    respond();
    mount(<Probe />);
    await waitFor(() =>
      expect(screen.getByLabelText('Selected person')).toHaveTextContent(
        'NX-4471',
      ),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Switch person' }),
    );
    expect(screen.getByLabelText('Selected person')).toHaveTextContent(
      'NX-2210',
    );
  });
  it('removes stale stored identity when the directory is empty', async () => {
    localStorage.setItem(identityStorageKey, 'NX-4471');
    respond([]);
    mount(<Probe />);
    await waitFor(() =>
      expect(localStorage.getItem(identityStorageKey)).toBeNull(),
    );
    expect(screen.getByLabelText('Selected person')).toBeEmptyDOMElement();
  });
});
describe('routing and shell', () => {
  it('renders Dashboard, accessible navigation and the real identity selector', async () => {
    respond();
    mount();
    expect(
      screen.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const selector = screen.getByRole('combobox', { name: 'Demo identity' });
    await waitFor(() => expect(selector).toHaveValue('NX-4471'));
    await userEvent.selectOptions(selector, 'NX-2210');
    expect(selector).toHaveValue('NX-2210');
  });
  for (const [path, title] of [
    ['/claims/aaaaaaaaaaaaaaaaaaaaaaaa', 'Expense Claim'],
    ['/trips/aaaaaaaaaaaaaaaaaaaaaaaa', 'Trip'],
    ['/trips/aaaaaaaaaaaaaaaaaaaaaaaa/evidence', 'Evidence'],
    ['/approvals', 'Approvals'],
    ['/finance', 'Finance'],
    ['/missing', 'Page not found'],
    ['/trips/invalid', 'Page not found'],
  ]) {
    it(`renders ${path} as ${title}`, async () => {
      respond();
      mount(<App />, path);
      expect(
        screen.getByRole('heading', { name: title!, level: 1 }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: 'Demo identity' }),
        ).toHaveValue('NX-4471'),
      );
    });
  }
  it('navigates to Approvals and marks the active link', async () => {
    respond();
    mount();
    await userEvent.click(screen.getByRole('link', { name: 'Approvals' }));
    expect(
      screen.getByRole('heading', { name: 'Approvals', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Approvals' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
  it('opens and closes labelled mobile navigation using buttons', async () => {
    respond();
    mount();
    const open = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(open);
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close navigation' }),
    );
    expect(open).toHaveAttribute('aria-expanded', 'false');
  });
  it('keeps the shell and retry action available on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server',
    );
    expect(
      screen.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
  it('renders shared network errors without a stack', () => {
    render(<ErrorState error={new NetworkError()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unable to reach the server',
    );
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });
});
