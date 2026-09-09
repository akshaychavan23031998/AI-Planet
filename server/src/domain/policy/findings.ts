import type { FindingCode, PolicyFinding } from './types.js';

export function finding(
  code: FindingCode,
  severity: PolicyFinding['severity'],
  message: string,
  policyReference: string,
  context: Pick<PolicyFinding, 'expenseKey' | 'evidenceKeys' | 'metadata'> & {
    historicalException?: boolean;
    userActionRequired?: boolean;
  } = {},
): PolicyFinding {
  return {
    code,
    severity,
    message,
    policyReference,
    blocking: severity === 'BLOCKING',
    userActionRequired: severity === 'BLOCKING',
    historicalException: false,
    ...context,
  };
}
export function informational(item: PolicyFinding): PolicyFinding {
  return {
    ...item,
    severity: 'INFO',
    blocking: false,
    userActionRequired: false,
  };
}
