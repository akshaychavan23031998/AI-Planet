import { assertMinor } from './money.js';
import type { Settlement } from './types.js';

export function adjustAdvance(eligibleMinor: number, advanceMinor: number) {
  assertMinor(eligibleMinor);
  assertMinor(advanceMinor);
  return {
    payableMinor: Math.max(eligibleMinor - advanceMinor, 0),
    recoverableMinor: Math.max(advanceMinor - eligibleMinor, 0),
  };
}
export function calculateSettlement(
  eligibleMinor: number,
  advanceMinor: number,
  unresolvedMinor: number,
  blocked = false,
): Settlement {
  assertMinor(eligibleMinor);
  assertMinor(advanceMinor);
  assertMinor(unresolvedMinor);
  return unresolvedMinor > 0 || blocked
    ? { isFinal: false, payableMinor: null, recoverableMinor: null }
    : { isFinal: true, ...adjustAdvance(eligibleMinor, advanceMinor) };
}
