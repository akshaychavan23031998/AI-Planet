import type { Evidence, Expense } from '../api/types';
import { Card, EmptyState, StatusBadge } from './ui';
import { SummaryCard } from './TripSummaryCard';
import { formatDateOnly, formatMoneyMinor, readable } from '../utils/format';
import styles from './workspace.module.css';
export function ExpenseList({
  expenses,
  evidence,
  onOpen,
}: {
  expenses: Expense[];
  evidence: Evidence[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className={styles.stack}>
      <div className={styles.summaryGrid}>
        <SummaryCard
          label="Employee-paid source gross"
          value={formatMoneyMinor(
            expenses
              .filter((item) => item.paidBy === 'EMPLOYEE')
              .reduce((sum, item) => sum + item.amountMinor, 0),
          )}
          note="Recorded source costs; not a reimbursement total"
        />
        <SummaryCard
          label="Company-paid source gross"
          value={formatMoneyMinor(
            expenses
              .filter((item) => item.paidBy === 'COMPANY')
              .reduce((sum, item) => sum + item.amountMinor, 0),
          )}
          note="Company costs retained for traceability"
        />
      </div>
      <Card>
        <div className={styles.sectionHeading}>
          <h2>Source-normalized expenses</h2>
          <p>
            {expenses.length} records · Source clarity is separate from policy
            eligibility.
          </p>
        </div>
        {!expenses.length ? (
          <EmptyState title="No expenses">
            No normalized expenses are available for this trip.
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {expenses.map((expense) => (
              <li key={expense.id} className={styles.expenseRow}>
                <div>
                  <strong>{expense.merchant}</strong>
                  <p>{expense.description}</p>
                  <small>
                    {readable(expense.category)} ·{' '}
                    {formatDateOnly(expense.expenseDate)}
                  </small>
                  {expense.sourceReviewNote && (
                    <p className={styles.muted}>{expense.sourceReviewNote}</p>
                  )}
                </div>
                <div>
                  <strong>
                    {formatMoneyMinor(expense.amountMinor, expense.currency)}
                  </strong>
                  <p>
                    <StatusBadge
                      variant={
                        expense.paidBy === 'COMPANY' ? 'info' : 'neutral'
                      }
                    >
                      {readable(expense.paidBy)} paid
                    </StatusBadge>
                  </p>
                  {expense.sourceReviewState === 'NEEDS_REVIEW' && (
                    <StatusBadge variant="warning">
                      Needs source review
                    </StatusBadge>
                  )}
                </div>
                <div>
                  {expense.sourceEvidence.map((id) => (
                    <button
                      key={id}
                      className={styles.proof}
                      onClick={() => onOpen(id)}
                    >
                      {evidence.find((item) => item.id === id)
                        ?.sourceFilename ?? 'View source evidence'}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
