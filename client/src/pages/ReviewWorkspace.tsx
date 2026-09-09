import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useReviewQueue,
  useReviewMutation,
  actionLabels,
  reviewMutationMessage,
  type ReviewAction,
} from '../app/workflowQueries';
import {
  useClaim,
  useClaimValidation,
  useClaimReadiness,
  useClaimSettlement,
} from '../app/claimQueries';
import { useEvidence, useExpenses, useTrip } from '../app/queries';
import { useDemoIdentity } from '../context/demoIdentity';
import {
  Card,
  EmptyState,
  PageHeader,
  LoadingState,
  StatusBadge,
} from '../components/ui';
import { QueryContent } from '../components/TripSummaryCard';
import { ClaimTimeline } from '../components/claims/ClaimTimeline';
import { SettlementSummary } from '../components/claims/SettlementSummary';
import { PolicyFindingList } from '../components/claims/PolicyFindingList';
import { ReviewActionDialog } from '../components/claims/ReviewActionDialog';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import type { Claim, ClaimSettlement } from '../api/claimTypes';
import { readable, formatDateOnly } from '../utils/format';
import styles from '../components/claims/claims.module.css';
import layout from './reviewWorkspace.module.css';
export function ReviewWorkspace({ finance = false }: { finance?: boolean }) {
  const queue = useReviewQueue(finance);
  const [selected, setSelected] = useState('');
  const [action, setAction] = useState<ReviewAction | null>(null);
  const mutation = useReviewMutation(selected);
  const visible =
    queue.data?.some((claim) => claim.id === selected) && !queue.isError;
  return (
    <>
      <PageHeader
        title={finance ? 'Finance' : 'Approvals'}
        description={
          finance
            ? 'Settlement verification and payment processing.'
            : 'Your assigned business reviews.'
        }
      />
      {mutation.data && !mutation.isPending && (
        <Card>
          <div className={styles.panel} role="status">
            <h2>Decision recorded</h2>
            <p>
              {readable(mutation.data.workflowEvent.action)} ·{' '}
              {readable(mutation.data.currentStatus)} · Review cycle{' '}
              {mutation.data.reviewCycle}
            </p>
            <p>{mutation.data.workflowEvent.remarks}</p>
            {mutation.data.workflowEvent.occurredAt && (
              <time dateTime={mutation.data.workflowEvent.occurredAt}>
                {mutation.data.workflowEvent.occurredAt}
              </time>
            )}
            {!visible && !queue.isError && (
              <p>This claim is no longer in your queue.</p>
            )}
          </div>
        </Card>
      )}
      {mutation.error && (!action || !visible) && (
        <p role="alert">{reviewMutationMessage(mutation.error)}</p>
      )}
      <div className={layout.workspace}>
        <Card>
          <div className={styles.panel}>
            <h2>{finance ? 'Finance queue' : 'Assigned claims'}</h2>
            {mutation.isPending ? (
              <LoadingState label="Updating queue..." />
            ) : (
              <QueryContent query={queue}>
                {(claims) =>
                  claims.length ? (
                    <ul className={layout.queue}>
                      {claims.map((claim) => (
                        <li key={claim.id}>
                          <button
                            className={layout.queueItem}
                            aria-pressed={selected === claim.id}
                            disabled={mutation.isPending || queue.isFetching}
                            onClick={() => {
                              setSelected(claim.id);
                              setAction(null);
                              mutation.reset();
                            }}
                          >
                            <strong>{claim.employee.name}</strong>
                            <span>
                              {claim.employee.employeeCode} ·{' '}
                              {claim.expenseCount} expenses · Cycle{' '}
                              {claim.reviewCycle}
                            </span>
                            <StatusBadge>{readable(claim.status)}</StatusBadge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="No claims in this queue">
                      No reviews are currently available for your selected
                      identity.
                    </EmptyState>
                  )
                }
              </QueryContent>
            )}
          </div>
        </Card>
        {selected && (visible || mutation.isPending) ? (
          <ReviewContext
            key={selected}
            id={selected}
            finance={finance}
            pending={mutation.isPending || queue.isFetching}
            onAction={(value) => {
              mutation.reset();
              setAction(value);
            }}
          />
        ) : (
          <Card>
            <EmptyState title="Select a claim">
              Choose a claim from the queue to review its evidence, policy
              findings and history.
            </EmptyState>
          </Card>
        )}
      </div>
      {action && (visible || mutation.isPending) && (
        <ReviewActionDialog
          action={action}
          pending={mutation.isPending}
          error={mutation.error}
          onClose={() => setAction(null)}
          onSave={async (command) => {
            try {
              await mutation.mutateAsync(command);
              setAction(null);
            } catch {
              /* Error stays in the action form. */
            }
          }}
        />
      )}
    </>
  );
}
function ReviewContext({
  id,
  finance,
  pending,
  onAction,
}: {
  id: string;
  finance: boolean;
  pending: boolean;
  onAction: (action: ReviewAction) => void;
}) {
  const claim = useClaim(id);
  const validation = useClaimValidation(id);
  const readiness = useClaimReadiness(id);
  const settlement = useClaimSettlement(id);
  if (
    pending ||
    claim.isFetching ||
    validation.isFetching ||
    readiness.isFetching ||
    settlement.isFetching
  )
    return <LoadingState label="Refreshing claim review..." />;
  return (
    <QueryContent query={claim}>
      {(record) => (
        <QueryContent query={validation}>
          {(evaluation) => (
            <QueryContent query={readiness}>
              {(ready) => (
                <QueryContent query={settlement}>
                  {(totals) => (
                    <div className={styles.stack}>
                      <Card>
                        <div className={styles.panel}>
                          <h2>{record.employee.name}</h2>
                          <p>
                            {record.employee.employeeCode} ·{' '}
                            {record.expenseCount} expenses · Review cycle{' '}
                            {record.reviewCycle}
                          </p>
                          <StatusBadge variant="info">
                            {readable(record.status)}
                          </StatusBadge>
                          <p>
                            <Link to={`/trips/${record.travelRequest}`}>
                              View trip
                            </Link>{' '}
                            ·{' '}
                            <Link to={`/claims/${id}`}>Inspect full claim</Link>
                          </p>
                          <p>
                            {ready.blockingIssues.length} blocking findings ·{' '}
                            {ready.warnings.length} warnings
                          </p>
                          {finance ? (
                            <FinanceActions
                              claim={record}
                              settlement={totals}
                              onAction={onAction}
                            />
                          ) : (
                            <div className={styles.actions}>
                              {(['return', 'approve'] as const).map(
                                (action) => (
                                  <button
                                    key={action}
                                    className={
                                      action === 'approve'
                                        ? styles.primary
                                        : styles.button
                                    }
                                    onClick={() => onAction(action)}
                                  >
                                    {actionLabels[action]}
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                      <ReviewTrip id={record.travelRequest} />
                      <SettlementSummary settlement={totals} />
                      <ReviewEvidence
                        claim={record}
                        findings={evaluation.findings}
                      />
                      <ClaimTimeline claim={record} />
                    </div>
                  )}
                </QueryContent>
              )}
            </QueryContent>
          )}
        </QueryContent>
      )}
    </QueryContent>
  );
}
function FinanceActions({
  claim,
  settlement,
  onAction,
}: {
  claim: Claim;
  settlement: ClaimSettlement;
  onAction: (action: ReviewAction) => void;
}) {
  const { availableUsers } = useDemoIdentity();
  const metadata = claim.finance;
  const verified =
    !!metadata?.verifiedAt &&
    !!metadata.verifiedBy &&
    metadata.reviewCycle === claim.reviewCycle;
  const payable = settlement.isFinal && (settlement.payableMinor ?? 0) > 0;
  const name = (id: string | null | undefined) =>
    availableUsers.find((person) => person.id === id)?.name ?? 'Not recorded';
  const actions: ReviewAction[] = [];
  if (claim.status === 'FINANCE_REVIEW') {
    if (!verified) actions.push('verify');
    actions.push('return');
    if (verified && payable) actions.push('schedule');
  }
  if (claim.status === 'PAYMENT_SCHEDULED' && verified && payable)
    actions.push('paid');
  return (
    <>
      <h3>Finance verification</h3>
      {metadata && (
        <dl className={styles.calculations}>
          <div>
            <dt>Verified by</dt>
            <dd>{name(metadata.verifiedBy)}</dd>
          </div>
          <div>
            <dt>Verified at</dt>
            <dd>{metadata.verifiedAt ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Verification cycle</dt>
            <dd>{metadata.reviewCycle}</dd>
          </div>
          <div>
            <dt>Scheduled payment</dt>
            <dd>
              {metadata.paymentScheduledFor
                ? formatDateOnly(metadata.paymentScheduledFor)
                : 'Not scheduled'}
            </dd>
          </div>
          <div>
            <dt>Scheduled by</dt>
            <dd>{name(metadata.paymentScheduledBy)}</dd>
          </div>
          <div>
            <dt>Paid at</dt>
            <dd>{metadata.paidAt ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Payment reference</dt>
            <dd>{metadata.paymentReference ?? 'Not recorded'}</dd>
          </div>
        </dl>
      )}
      {verified && <p>Verified for this review cycle.</p>}
      {verified && settlement.isFinal && !payable && (
        <p>
          No reimbursement payment is due.{' '}
          {settlement.recoverableMinor
            ? 'The settlement is recoverable from the employee.'
            : 'The settlement has no payable balance.'}{' '}
          Finance review remains the recorded state; no recovery completion is
          inferred.
        </p>
      )}
      <div className={styles.actions}>
        {actions.map((action) => (
          <button
            key={action}
            className={action === 'return' ? styles.button : styles.primary}
            onClick={() => onAction(action)}
          >
            {actionLabels[action]}
          </button>
        ))}
      </div>
    </>
  );
}
function ReviewEvidence({
  claim,
  findings,
}: {
  claim: Claim;
  findings: import('../api/claimTypes').PolicyFinding[];
}) {
  const evidence = useEvidence(claim.travelRequest);
  const expenses = useExpenses(claim.travelRequest);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <div className={styles.panel}>
        <h2>Policy findings and evidence</h2>
        <QueryContent query={evidence}>
          {(items) => (
            <>
              <PolicyFindingList
                findings={findings}
                evidence={items}
                expenses={[]}
                onEvidence={setOpen}
              />
              <details>
                <summary>All supporting evidence ({items.length})</summary>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        className={styles.button}
                        onClick={() => setOpen(item.id)}
                      >
                        {item.sourceFilename}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
              {open && (
                <EvidenceDrawer
                  id={open}
                  evidence={items}
                  expenses={expenses.data}
                  onClose={() => setOpen(null)}
                  onSelect={setOpen}
                />
              )}
            </>
          )}
        </QueryContent>
      </div>
    </Card>
  );
}

function ReviewTrip({ id }: { id: string }) {
  const trip = useTrip(id);
  return (
    <Card>
      <div className={styles.panel}>
        <h2>Trip context</h2>
        <QueryContent query={trip}>
          {(record) => (
            <>
              <p>
                {record.origin} to {record.destination}
              </p>
              <p>
                {formatDateOnly(record.startDate)} to{' '}
                {formatDateOnly(record.endDate)}
              </p>
              <p>{record.purpose}</p>
              <p>
                Travel Request ID:{' '}
                {record.travelRequestId ?? 'Not provided in source'}
              </p>
            </>
          )}
        </QueryContent>
      </div>
    </Card>
  );
}
