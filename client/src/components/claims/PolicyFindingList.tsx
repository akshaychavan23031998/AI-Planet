import type { PolicyFinding } from '../../api/claimTypes';
import type { Evidence, Expense } from '../../api/types';
import { StatusBadge } from '../ui';
import styles from './claims.module.css';
export function PolicyFindingList({
  findings,
  evidence,
  expenses,
  onEvidence,
}: {
  findings: PolicyFinding[];
  evidence: Evidence[];
  expenses: Expense[];
  onEvidence: (id: string) => void;
}) {
  if (!findings.length)
    return <p className={styles.muted}>No findings in this group.</p>;
  return (
    <ul className={styles.findings}>
      {findings.map((finding, index) => (
        <li
          key={`${finding.code}-${finding.expenseKey ?? index}`}
          className={`${styles.finding} ${styles[finding.severity.toLowerCase()]}`}
        >
          <div className={styles.actions}>
            <StatusBadge
              variant={
                finding.severity === 'BLOCKING'
                  ? 'danger'
                  : finding.severity === 'WARNING'
                    ? 'warning'
                    : 'info'
              }
            >
              {finding.severity === 'BLOCKING'
                ? 'Blocking'
                : finding.severity === 'WARNING'
                  ? 'Warning'
                  : 'Information'}
            </StatusBadge>
            {finding.historicalException && (
              <StatusBadge>Historical exception</StatusBadge>
            )}
            {finding.userActionRequired && (
              <StatusBadge variant="warning">Action required</StatusBadge>
            )}
          </div>
          <p>{finding.message}</p>
          <small>
            {finding.policyReference} · {finding.code}
          </small>
          <div className={styles.actions}>
            {finding.expenseKey &&
              expenses.some((expense) => expense.id === finding.expenseKey) && (
                <a href={`#expense-${finding.expenseKey}`}>View expense</a>
              )}
            {finding.evidenceKeys?.map((id) => (
              <button
                className={styles.link}
                key={id}
                onClick={() => onEvidence(id)}
              >
                {evidence.find((item) => item.id === id)?.sourceFilename ??
                  'View evidence'}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
