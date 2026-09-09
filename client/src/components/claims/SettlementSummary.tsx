import type { ClaimSettlement } from '../../api/claimTypes';
import { Card, StatusBadge } from '../ui';
import { formatMoneyMinor } from '../../utils/format';
import styles from './claims.module.css';
export function SettlementSummary({
  settlement,
}: {
  settlement: ClaimSettlement;
}) {
  const rows: [string, number | null][] = [
    ['Employee-paid gross', settlement.employeePaidGrossMinor],
    ['Company-paid gross (memo only)', settlement.companyPaidGrossMinor],
    ['Known eligible', settlement.knownEligibleMinor],
    ['Known disallowed', settlement.knownDisallowedMinor],
    ['Employee-excluded amount', settlement.excludedMinor],
    ['Unresolved amount', settlement.unresolvedMinor],
    ['Travel advance', settlement.advanceMinor],
    ['Payable to employee', settlement.payableMinor],
    ['Recoverable from employee', settlement.recoverableMinor],
  ];
  return (
    <Card>
      <div className={styles.panel}>
        <h2>Settlement summary</h2>
        <StatusBadge variant={settlement.isFinal ? 'success' : 'warning'}>
          {settlement.isFinal ? 'Final calculation' : 'Provisional · not final'}
        </StatusBadge>
        <dl className={styles.calculations}>
          {rows.map(([label, amount]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {amount === null
                  ? 'Pending resolution'
                  : formatMoneyMinor(amount)}
              </dd>
            </div>
          ))}
        </dl>
        {settlement.isFinal &&
          settlement.payableMinor === 0 &&
          settlement.recoverableMinor === 0 && (
            <p>No balance payable or recoverable.</p>
          )}
        <p className={styles.muted}>
          Backend policy evaluation. Final calculation does not mean approval or
          payment is complete.
        </p>
      </div>
    </Card>
  );
}
