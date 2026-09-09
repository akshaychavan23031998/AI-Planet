import { describe, it, expect, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ApiError, NetworkError, ConfigurationError } from '../api/errors';
import { getDemoUsers } from '../api/demo';
import { queryKeys } from '../api/queryKeys';
import { createQueryClient } from '../app/queryClient';
import { apiBaseUrl } from '../config';

describe('API client', () => {
  it('returns JSON and sends the captured actor header and body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetch);
    expect(
      await apiRequest({
        path: '/api/v1/claims',
        method: 'POST',
        employeeCode: 'NX-4471',
        body: { reason: 'Review' },
      }),
    ).toEqual({ data: { ok: true } });
    const [url, options] = fetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/claims');
    const headers = new Headers(options.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Demo-Employee-Code')).toBe('NX-4471');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ reason: 'Review' }));
  });
  it('public demo lookup omits identity and content-type headers', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [], meta: { count: 0 } }));
    vi.stubGlobal('fetch', fetch);
    expect(await getDemoUsers()).toEqual([]);
    const options = fetch.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(options.headers);
    expect(headers.has('X-Demo-Employee-Code')).toBe(false);
    expect(headers.has('Content-Type')).toBe(false);
  });
  it('preserves backend error status, code, message and details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: 'POLICY_NOT_READY',
              message: 'Review required',
              details: { findings: [] },
            },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(apiRequest({ path: '/api/v1/claims' })).rejects.toMatchObject({
      status: 422,
      code: 'POLICY_NOT_READY',
      message: 'Review required',
      details: { findings: [] },
    });
  });
  it('distinguishes network failure from API status 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(apiRequest({ path: '/api/v1/claims' })).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
  it('passes AbortSignal and preserves cancellation', async () => {
    const controller = new AbortController();
    const aborted = new DOMException('Aborted', 'AbortError');
    const fetch = vi.fn().mockRejectedValue(aborted);
    vi.stubGlobal('fetch', fetch);
    await expect(
      apiRequest({ path: '/api/v1/claims', signal: controller.signal }),
    ).rejects.toBe(aborted);
    expect((fetch.mock.calls[0]![1] as RequestInit).signal).toBe(
      controller.signal,
    );
  });
  it('reports unreadable responses without exposing raw HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>private diagnostics</html>', { status: 502 }),
        ),
    );
    await expect(apiRequest({ path: '/api/v1/claims' })).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    });
  });
  it('rejects paths that could send the identity to another destination', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      apiRequest({ path: '//other.example', employeeCode: 'NX-4471' }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('validates public base URL configuration without accepting credentials or query strings', () => {
    expect(apiBaseUrl('https://example.com/')).toBe('https://example.com');
    for (const value of [
      'not-a-url',
      'ftp://example.com',
      'https://example.com/?x=1',
      'https://user:secret@example.com',
    ])
      expect(() => apiBaseUrl(value)).toThrow(ConfigurationError);
  });
});
describe('query conventions', () => {
  it('isolates protected cached data by employee code', () => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.actor('NX-4471', 'claims'), [
      'claimant-only',
    ]);
    expect(
      client.getQueryData(queryKeys.actor('NX-2210', 'claims')),
    ).toBeUndefined();
    expect(client.getQueryData(queryKeys.actor('NX-4471', 'claims'))).toEqual([
      'claimant-only',
    ]);
    expect(() => queryKeys.actor('', 'claims')).toThrow();
    client.clear();
  });
  it('retries transient failures once but never retries domain failures or mutations', () => {
    const defaults = createQueryClient().getDefaultOptions();
    const retry = defaults.queries?.retry;
    expect(typeof retry).toBe('function');
    if (typeof retry !== 'function') throw new Error('Expected retry function');
    expect(retry(0, new ApiError(403, 'FORBIDDEN', 'Denied'))).toBe(false);
    expect(retry(0, new NetworkError())).toBe(true);
    expect(retry(1, new NetworkError())).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
