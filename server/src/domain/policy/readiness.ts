import type { PolicyFinding, Readiness } from './types.js';

export function evaluateReadiness(
  findings: readonly PolicyFinding[],
  isFinal: boolean,
): Readiness {
  const blockingIssues = findings.filter((item) => item.blocking);
  return {
    isReadyToSubmit: isFinal && blockingIssues.length === 0,
    blockingIssues,
    warnings: findings.filter((item) => item.severity === 'WARNING'),
    informational: findings.filter((item) => item.severity === 'INFO'),
  };
}
