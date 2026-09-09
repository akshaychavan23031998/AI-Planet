import type { Claim } from '../../api/claimTypes';
import { useDemoIdentity } from '../../context/demoIdentity';
import { formatTimestamp, readable } from '../../utils/format';
import { Card, EmptyState, StatusBadge } from '../ui';
import styles from './claims.module.css';
export function ClaimTimeline({ claim }: { claim: Claim }) {
  const { availableUsers } = useDemoIdentity();
  const name = (id: string) =>
    availableUsers.find((person) => person.id === id)?.name ??
    'Recorded reviewer';
  const cycles = [
    ...new Set([
      ...claim.workflowHistory.map((item) => item.reviewCycle),
      ...claim.approvals.map((item) => item.reviewCycle),
    ]),
  ].sort((a, b) => a - b);
  return (
    <Card>
      <div className={styles.panel}>
        <h2>Workflow timeline</h2>
        <p className={styles.muted}>
          Current review cycle {claim.reviewCycle}. Previous-cycle approvals
          remain audit history.
        </p>
        {!cycles.length && (
          <EmptyState title="No workflow events">
            This claim has no recorded submission or review events.
          </EmptyState>
        )}
        {cycles.map((cycle) => (
          <section key={cycle}>
            <h3>Review cycle {cycle}</h3>
            <ol className={styles.timeline}>
              {claim.workflowHistory
                .filter((item) => item.reviewCycle === cycle)
                .map((item, index) => (
                  <li key={index}>
                    <StatusBadge variant="info">
                      {readable(item.action)}
                    </StatusBadge>
                    <p>
                      {name(item.actor)} · {readable(item.actorRole)}
                    </p>
                    <p>
                      {readable(item.fromStatus)} → {readable(item.toStatus)}
                    </p>
                    <small>{formatTimestamp(item.occurredAt)}</small>
                    {item.remarks && <blockquote>{item.remarks}</blockquote>}
                  </li>
                ))}
            </ol>
            {claim.approvals.filter((item) => item.reviewCycle === cycle)
              .length > 0 && (
              <details>
                <summary>Recorded approval decisions</summary>
                {claim.approvals
                  .filter((item) => item.reviewCycle === cycle)
                  .map((item, index) => (
                    <p key={index}>
                      {name(item.approver)} · {readable(item.level)} ·{' '}
                      {readable(item.decision)} ·{' '}
                      {formatTimestamp(item.decidedAt)}
                      {item.remarks && ` — ${item.remarks}`}
                    </p>
                  ))}
              </details>
            )}
          </section>
        ))}
      </div>
    </Card>
  );
}
