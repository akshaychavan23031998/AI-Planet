import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as api from '../api/claims';
import { claimStatuses } from '../api/claimTypes';
import type { ClaimStatus } from '../api/claimTypes';
import { ApiError } from '../api/errors';
import { parseMoneyInput } from '../utils/moneyInput';
import {
  claimId,
  dinner,
  hotelTax,
  initialClaim,
  initialValidation,
  initialReadiness,
  initialSettlement,
} from './claimFixtures';
describe('claim HTTP contract', () => {
  const cases = [
    [
      'detail',
      '',
      'GET',
      undefined,
      () => api.getClaim('NX-4471', claimId),
      initialClaim,
    ],
    [
      'validation',
      '/validation',
      'GET',
      undefined,
      () => api.getClaimValidation('NX-4471', claimId),
      initialValidation,
    ],
    [
      'readiness',
      '/readiness',
      'GET',
      undefined,
      () => api.getClaimReadiness('NX-4471', claimId),
      initialReadiness,
    ],
    [
      'settlement',
      '/settlement',
      'GET',
      undefined,
      () => api.getClaimSettlement('NX-4471', claimId),
      initialSettlement,
    ],
    [
      'exclude',
      `/expenses/${dinner.id}/exclude`,
      'POST',
      { reason: 'Missing evidence' },
      () =>
        api.excludeClaimExpense(
          'NX-4471',
          claimId,
          dinner.id,
          'Missing evidence',
        ),
      initialClaim,
    ],
    [
      'restore',
      `/expenses/${dinner.id}/restore`,
      'POST',
      undefined,
      () => api.restoreClaimExpense('NX-4471', claimId, dinner.id),
      initialClaim,
    ],
    [
      'resolve',
      `/expenses/${hotelTax.id}/resolve`,
      'POST',
      {
        reimbursableMinor: 100000,
        disallowedMinor: 130400,
        reason: 'Hypothetical reviewed split',
      },
      () =>
        api.resolveClaimExpense('NX-4471', claimId, hotelTax.id, {
          reimbursableMinor: 100000,
          disallowedMinor: 130400,
          reason: 'Hypothetical reviewed split',
        }),
      initialClaim,
    ],
    [
      'submit',
      '/submit',
      'POST',
      undefined,
      () => api.submitClaim('NX-4471', claimId),
      { claimId, currentStatus: 'MANAGER_REVIEW' },
    ],
    [
      'resubmit',
      '/resubmit',
      'POST',
      undefined,
      () => api.resubmitClaim('NX-4471', claimId),
      { claimId, currentStatus: 'MANAGER_REVIEW' },
    ],
  ] as const;
  for (const [name, suffix, method, body, invoke, data] of cases)
    it(`uses the exact ${name} route, actor and narrow body`, async () => {
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data }));
      vi.stubGlobal('fetch', fetcher);
      expect(await invoke()).toEqual(data);
      const [url, options] = fetcher.mock.calls[0]! as [string, RequestInit];
      expect(url).toBe(
        `http://localhost:3000/api/v1/claims/${claimId}${suffix}`,
      );
      expect(options.method).toBe(method);
      expect(new Headers(options.headers).get('X-Demo-Employee-Code')).toBe(
        'NX-4471',
      );
      expect(options.body).toBe(
        body === undefined ? undefined : JSON.stringify(body),
      );
    });
  it('excludes SUBMITTED from persistent statuses while retaining all nine states', () => {
    expectTypeOf<'SUBMITTED'>().not.toExtend<ClaimStatus>();
    expect(claimStatuses).toEqual([
      'DRAFT',
      'MANAGER_REVIEW',
      'HOD_REVIEW',
      'DIVISION_REVIEW',
      'MD_REVIEW',
      'FINANCE_REVIEW',
      'RETURNED',
      'PAYMENT_SCHEDULED',
      'PAID',
    ]);
  });
  it('propagates mutation status, code and details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: 'INVALID_MANUAL_RESOLUTION',
              message: 'Review this split.',
              details: { fields: ['disallowedMinor'] },
            },
          },
          { status: 422 },
        ),
      ),
    );
    await expect(
      api.resolveClaimExpense('NX-4471', claimId, hotelTax.id, {
        reimbursableMinor: 1,
        disallowedMinor: 2,
        reason: 'Test',
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_MANUAL_RESOLUTION',
      details: { fields: ['disallowedMinor'] },
    } satisfies Partial<ApiError>);
  });
});
describe('decimal money input', () => {
  it.each([
    ['2070.00', 207000],
    ['0', 0],
    ['1.01', 101],
    [' 12.5 ', 1250],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('parses %s exactly', (input, output) =>
    expect(parseMoneyInput(input as string)).toBe(output),
  );
  it.each([
    '-1',
    '1.001',
    '',
    '1e3',
    '1,000',
    'NaN',
    'Infinity',
    '90071992547409.92',
  ])('rejects %s', (input) => expect(parseMoneyInput(input)).toBeNull());
});
