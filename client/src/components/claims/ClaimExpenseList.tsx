import type { Claim, ClaimValidation } from '../../api/claimTypes';
import type { Evidence, Expense } from '../../api/types';
import {
  formatDateOnly,
  formatMoneyMinor,
  formatTimestamp,
  readable,
} from '../../utils/format';
import { Card, EmptyState, StatusBadge } from '../ui';
import { PolicyFindingList } from './PolicyFindingList';
import styles from './claims.module.css';
export function ClaimExpenseList({
  claim,
  validation,
  expenses,
  evidence,
  editable,
  pending,
  onEvidence,
  onDecision,
  onRestore,
}: {
  claim: Claim;
  validation: ClaimValidation;
  expenses: Expense[];
  evidence: Evidence[];
  editable: boolean;
  pending: boolean;
  onEvidence: (id: string) => void;
  onDecision: (expense: Expense, action: 'exclude' | 'resolve') => void;
  onRestore: (id: string) => void;
}) {
  const records = expenses.filter((expense) =>
    validation.expenseResults.some(
      (result) => result.expenseKey === expense.id,
    ),
  );
  const categories = [...new Set(records.map((expense) => expense.category))];
  if (!records.length)
    return (
      <EmptyState title="No claim expenses">
        No source expenses are available for this claim.
      </EmptyState>
    );
  return (
    <div className={styles.stack}>
      {categories.map((category) => (
        <Card key={category}>
          <div className={styles.panel}>
            <h2>{readable(category)}</h2>
            <ul
              className={styles.expenses}
              aria-label={`${readable(category)} expenses`}
            >
              {records
                .filter((expense) => expense.category === category)
                .map((expense) => {
                  const review = claim.expenseReviews.find(
                    (item) => item.expense === expense.id,
                  );
                  const result = validation.expenseResults.find(
                    (item) => item.expenseKey === expense.id,
                  )!;
                  const history = claim.expenseReviewHistory.filter(
                    (item) => item.expense === expense.id,
                  );
                  return (
                    <li
                      id={`expense-${expense.id}`}
                      key={expense.id}
                      className={styles.expense}
                      aria-label={`${expense.merchant}: ${expense.description}`}
                      tabIndex={-1}
                    >
                      <div className={styles.expenseMain}>
                        <div>
                          <h3>{expense.merchant}</h3>
                          <p>{expense.description}</p>
                          <small>
                            {formatDateOnly(expense.expenseDate)} ·{' '}
                            {readable(expense.componentType)}
                          </small>
                          <p>
                            <StatusBadge
                              variant={
                                expense.paidBy === 'COMPANY'
                                  ? 'info'
                                  : 'neutral'
                              }
                            >
                              {readable(expense.paidBy)} paid
                            </StatusBadge>
                          </p>
                        </div>
                        <div>
                          <span className={styles.muted}>Source amount</span>
                          <strong className={styles.amount}>
                            {formatMoneyMinor(
                              expense.amountMinor,
                              expense.currency,
                            )}
                          </strong>
                          <small>
                            Source:{' '}
                            {expense.sourceReviewState === 'CLEAR'
                              ? 'Clear'
                              : 'Needs review'}
                          </small>
                          {expense.sourceReviewNote && (
                            <p>{expense.sourceReviewNote}</p>
                          )}
                        </div>
                        <div>
                          <span className={styles.muted}>Claim treatment</span>
                          <p>
                            <StatusBadge
                              variant={
                                review?.included === false ? 'neutral' : 'info'
                              }
                            >
                              {expense.paidBy === 'COMPANY'
                                ? 'Memo only'
                                : review?.included === false
                                  ? 'Excluded'
                                  : 'Included'}
                            </StatusBadge>
                          </p>
                          <StatusBadge
                            variant={
                              result.status === 'UNRESOLVED'
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {readable(result.status)}
                          </StatusBadge>
                          {review?.exclusionReason && (
                            <p>{review.exclusionReason}</p>
                          )}
                          {review?.manualResolution && (
                            <p>
                              Recorded allocation:{' '}
                              {formatMoneyMinor(
                                review.manualResolution.reimbursableMinor,
                              )}{' '}
                              reimbursable /{' '}
                              {formatMoneyMinor(
                                review.manualResolution.disallowedMinor,
                              )}{' '}
                              disallowed.
                              <br />
                              {review.manualResolution.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={styles.actions}>
                        {expense.sourceEvidence.map((id) => (
                          <button
                            className={styles.link}
                            key={id}
                            onClick={() => onEvidence(id)}
                          >
                            {evidence.find((item) => item.id === id)
                              ?.sourceFilename ?? 'View source evidence'}
                          </button>
                        ))}
                        {editable && expense.paidBy === 'EMPLOYEE' && (
                          <>
                            {review?.included === false ? (
                              <button
                                className={styles.button}
                                disabled={pending}
                                onClick={() => onRestore(expense.id)}
                              >
                                Restore to claim
                              </button>
                            ) : (
                              <button
                                className={styles.button}
                                disabled={pending}
                                onClick={() => onDecision(expense, 'exclude')}
                              >
                                Exclude from claim
                              </button>
                            )}
                            {expense.componentType === 'HOTEL_MIXED_TAX' && (
                              <button
                                className={styles.button}
                                disabled={pending}
                                onClick={() => onDecision(expense, 'resolve')}
                              >
                                {review?.manualResolution
                                  ? 'Review tax allocation'
                                  : 'Resolve hotel tax'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {result.findings.length > 0 && (
                        <details>
                          <summary>
                            Policy findings ({result.findings.length})
                          </summary>
                          <PolicyFindingList
                            findings={result.findings}
                            expenses={expenses}
                            evidence={evidence}
                            onEvidence={onEvidence}
                          />
                        </details>
                      )}
                      {!!history.length && (
                        <details>
                          <summary>
                            Expense review history ({history.length})
                          </summary>
                          {history.map((event, index) => (
                            <p key={index}>
                              {readable(event.action)} ·{' '}
                              {formatTimestamp(event.occurredAt)}
                              {event.reason && ` — ${event.reason}`}
                              {event.resolution &&
                                ` · ${formatMoneyMinor(event.resolution.reimbursableMinor)} reimbursable / ${formatMoneyMinor(event.resolution.disallowedMinor)} disallowed`}
                            </p>
                          ))}
                        </details>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  );
}
