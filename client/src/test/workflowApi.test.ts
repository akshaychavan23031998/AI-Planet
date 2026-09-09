import { describe, it, expect, vi } from 'vitest';
import * as api from '../api/workflow';
import { ApiError } from '../api/errors';
const id = 'claim-id';
describe('review API contract', () => {
  const cases = [
    ['/approvals', 'GET', undefined, () => api.getApprovals('NX-2210')],
    [
      '/finance/claims',
      'GET',
      undefined,
      () => api.getFinanceClaims('NX-2210'),
    ],
    [
      `/claims/${id}/approve`,
      'POST',
      {},
      () => api.approveClaim('NX-2210', id),
    ],
    [
      `/claims/${id}/approve`,
      'POST',
      { remarks: 'Reviewed' },
      () => api.approveClaim('NX-2210', id, 'Reviewed'),
    ],
    [
      `/claims/${id}/return`,
      'POST',
      { remarks: 'Missing proof' },
      () => api.returnClaim('NX-2210', id, 'Missing proof'),
    ],
    [
      `/claims/${id}/finance/verify`,
      'POST',
      {},
      () => api.verifyClaim('NX-2210', id),
    ],
    [
      `/claims/${id}/finance/verify`,
      'POST',
      { remarks: 'Checked' },
      () => api.verifyClaim('NX-2210', id, 'Checked'),
    ],
    [
      `/claims/${id}/finance/schedule-payment`,
      'POST',
      { scheduledFor: '2026-09-25' },
      () => api.schedulePayment('NX-2210', id, '2026-09-25'),
    ],
    [
      `/claims/${id}/finance/mark-paid`,
      'POST',
      { paymentReference: 'BANK-123' },
      () => api.markPaid('NX-2210', id, 'BANK-123'),
    ],
  ] as const;
  it.each(cases)(
    '%s %s sends only documented input',
    async (path, method, body, invoke) => {
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [] }));
      vi.stubGlobal('fetch', fetcher);
      expect(await invoke()).toEqual([]);
      const [url, options] = fetcher.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe(`http://localhost:3000/api/v1${path}`);
      expect(options.method).toBe(method);
      expect(options.body).toBe(body ? JSON.stringify(body) : undefined);
      expect(new Headers(options.headers).get('X-Demo-Employee-Code')).toBe(
        'NX-2210',
      );
    },
  );
  it('forwards cancellation on queue reads', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    await api.getApprovals('NX-2210', controller.signal);
    expect(fetcher.mock.calls[0]![1].signal).toBe(controller.signal);
  });
  it('preserves controlled server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: 'CLAIM_STATE_CONFLICT', message: 'Changed' } },
            { status: 409 },
          ),
        ),
    );
    await expect(api.approveClaim('NX-2210', id)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
