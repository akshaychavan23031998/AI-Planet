import { assertMinor } from './money.js';
import { finding } from './findings.js';
import type { PolicyFinding } from './types.js';

export function assessAdvanceCap(
  advanceMinor: number,
  estimatedEmployeeBorneMinor?: number | null,
): {
  status: 'PASS' | 'FAIL' | 'UNDETERMINED';
  capMinor: number | null;
  findings: PolicyFinding[];
} {
  assertMinor(advanceMinor);
  if (estimatedEmployeeBorneMinor == null)
    return {
      status: 'UNDETERMINED',
      capMinor: null,
      findings: [
        finding(
          'ADVANCE_CAP_UNDETERMINED',
          'WARNING',
          'Estimated employee-borne cost is unknown; the total travel estimate cannot validate the advance cap.',
          '§1.2',
          { historicalException: true },
        ),
      ],
    };
  assertMinor(estimatedEmployeeBorneMinor);
  // Integer floor is the greatest whole-paise advance within the exact 60% cap.
  const capMinor = Number((BigInt(estimatedEmployeeBorneMinor) * 3n) / 5n);
  return {
    status: advanceMinor <= capMinor ? 'PASS' : 'FAIL',
    capMinor,
    findings:
      advanceMinor <= capMinor
        ? []
        : [
            finding(
              'ADVANCE_CAP_EXCEEDED',
              'WARNING',
              'Disbursed advance exceeds 60% of estimated employee-borne cost.',
              '§1.2',
              {
                historicalException: true,
                metadata: { capMinor, advanceMinor },
              },
            ),
          ],
  };
}
