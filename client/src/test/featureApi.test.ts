import { describe, expect, it, vi } from 'vitest';
import { getTravelRequest, getTravelRequests } from '../api/travelRequests';
import { getEvidence, getEvidenceDetail } from '../api/evidence';
import { getExpenses } from '../api/expenses';
import { getClaims } from '../api/claims';
import { ApiError } from '../api/errors';
import { formatMoneyMinor, formatDateOnly } from '../utils/format';
import { tripId, trip, evidence, expenses, claims } from './fixtures';
describe('feature API reads', () => {
  const cases = [
    [
      'travel list',
      '/travel-requests',
      () => getTravelRequests('NX-4471'),
      [trip],
    ],
    [
      'travel detail',
      `/travel-requests/${tripId}`,
      () => getTravelRequest('NX-4471', tripId),
      trip,
    ],
    [
      'evidence list',
      `/travel-requests/${tripId}/evidence`,
      () => getEvidence('NX-4471', tripId),
      evidence,
    ],
    [
      'evidence detail',
      `/evidence/${evidence[0]!.id}`,
      () => getEvidenceDetail('NX-4471', evidence[0]!.id),
      evidence[0],
    ],
    [
      'expenses',
      `/travel-requests/${tripId}/expenses`,
      () => getExpenses('NX-4471', tripId),
      expenses,
    ],
    ['claims', '/claims', () => getClaims('NX-4471'), claims],
  ] as const;
  for (const [name, path, load, data] of cases) {
    it(`reads ${name} with the actor header and unwraps data`, async () => {
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data }));
      vi.stubGlobal('fetch', fetcher);
      expect(await load()).toEqual(data);
      expect(fetcher.mock.calls[0]![0]).toBe(
        `http://localhost:3000/api/v1${path}`,
      );
      const options = fetcher.mock.calls[0]![1] as RequestInit;
      expect(new Headers(options.headers).get('X-Demo-Employee-Code')).toBe(
        'NX-4471',
      );
      expect(options.method).toBe('GET');
    });
  }
  it('encodes supported evidence filters', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetcher);
    await getEvidence('NX-4471', tripId, {
      kind: 'EMAIL',
      classification: 'NEEDS_REVIEW',
    });
    expect(fetcher.mock.calls[0]![0]).toContain(
      '/evidence?kind=EMAIL&classification=NEEDS_REVIEW',
    );
  });
  for (const status of [401, 403, 404, 500])
    it(`preserves API error ${status}`, async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { error: { code: 'READ_FAILED', message: 'Read unavailable' } },
              { status },
            ),
          ),
      );
      await expect(getTravelRequest('NX-4471', tripId)).rejects.toMatchObject({
        status,
        code: 'READ_FAILED',
        message: 'Read unavailable',
      } satisfies Partial<ApiError>);
    });
});
describe('source value formatting', () => {
  it('formats integer paise with Indian currency grouping', () =>
    expect(formatMoneyMinor(141502)).toBe('₹1,415.02'));
  it('distinguishes missing money from zero', () => {
    expect(formatMoneyMinor(null)).toBe('Not available');
    expect(formatMoneyMinor(0)).toBe('₹0.00');
  });
  it('formats a business date independently of the system timezone', () => {
    expect(formatDateOnly('2026-06-18')).toBe('18 Jun 2026');
    expect(formatDateOnly('2026-01-01')).toBe('1 Jan 2026');
  });
  it('handles missing and invalid business dates', () => {
    expect(formatDateOnly(null)).toBe('Not available');
    expect(formatDateOnly('2026-02-30')).toBe('Not available');
  });
});
