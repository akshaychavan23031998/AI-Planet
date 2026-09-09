import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTrip, useExpenses, useEvidence } from '../app/queries';
import { useDemoIdentity } from '../context/demoIdentity';
import { Card, PageHeader, StatusBadge, EmptyState } from '../components/ui';
import {
  QueryContent,
  SummaryCard,
  ClaimLink,
} from '../components/TripSummaryCard';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { ExpenseList } from '../components/ExpenseList';
import {
  formatDateOnly,
  formatMoneyMinor,
  formatTimestamp,
  readable,
} from '../utils/format';
import { NotFoundPage } from './pages';
import styles from '../components/workspace.module.css';
export function TripPage() {
  const { travelRequestId } = useParams();
  if (!travelRequestId || !/^[a-fA-F0-9]{24}$/.test(travelRequestId))
    return <NotFoundPage />;
  return <TripContent key={travelRequestId} id={travelRequestId} />;
}
function TripContent({ id }: { id: string }) {
  const trip = useTrip(id);
  const evidence = useEvidence(id);
  const expenses = useExpenses(id);
  const { availableUsers } = useDemoIdentity();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <PageHeader
        title="Trip"
        description="Source-backed travel context and normalized expenses."
      />
      <QueryContent query={trip}>
        {(item) => (
          <div className={styles.stack}>
            <Card>
              <div className={styles.hero}>
                <div>
                  <StatusBadge variant="info">
                    {readable(item.travelType)}
                  </StatusBadge>
                  <h2 className={styles.route}>
                    {item.origin} → {item.destination}
                  </h2>
                  <p>
                    {formatDateOnly(item.startDate)} –{' '}
                    {formatDateOnly(item.endDate)}
                  </p>
                  <p>{item.purpose}</p>
                </div>
                <Link to={`/trips/${id}/evidence`}>Review evidence</Link>
              </div>
              <dl className={styles.facts}>
                <div>
                  <dt>Employee</dt>
                  <dd>
                    {item.employee.name} · {item.employee.employeeCode}
                  </dd>
                </div>
                <div>
                  <dt>Cost centre</dt>
                  <dd>{item.costCentre}</dd>
                </div>
                <div>
                  <dt>Travel Request ID</dt>
                  <dd>
                    {item.travelRequestId ?? 'Unknown / Needs confirmation'}
                  </dd>
                </div>
                <div>
                  <dt>Planned lodging</dt>
                  <dd>{item.plannedLodgingNights} nights</dd>
                </div>
                <div>
                  <dt>Evidenced lodging</dt>
                  <dd>
                    {item.evidencedLodgingNights == null
                      ? 'Not available'
                      : `${item.evidencedLodgingNights} nights`}
                  </dd>
                </div>
              </dl>
            </Card>
            <div className={styles.summaryGrid}>
              <SummaryCard
                label="Estimated spend"
                value={formatMoneyMinor(
                  item.estimatedSpendMinor,
                  item.currency,
                )}
                note="Source estimate"
              />
              <SummaryCard
                label="Advance requested"
                value={formatMoneyMinor(
                  item.advanceRequestedMinor,
                  item.currency,
                )}
                note="Travel request"
              />
              <SummaryCard
                label="Advance disbursed"
                value={formatMoneyMinor(
                  item.advanceDisbursedMinor,
                  item.currency,
                )}
                note={`${item.advanceReference ?? 'Reference not available'} · ${formatDateOnly(item.advanceDisbursedDate)}`}
              />
            </div>
            <div className={styles.columns}>
              <Card>
                <h2>Historical pre-travel approvals</h2>
                <p className={styles.muted}>
                  Only recorded source approvals are shown.
                </p>
                {!item.preTravelApprovals.length && (
                  <EmptyState title="No approval evidence">
                    No pre-travel approval is recorded.
                  </EmptyState>
                )}
                {item.preTravelApprovals.map((approval) => (
                  <div
                    className={styles.linkedExpense}
                    key={`${approval.approver}-${approval.evidence}`}
                  >
                    <strong>
                      {availableUsers.find(
                        (person) => person.id === approval.approver,
                      )?.name ?? readable(approval.role)}
                    </strong>
                    <p>
                      {readable(approval.role)} ·{' '}
                      <StatusBadge variant="success">
                        {readable(approval.decision)}
                      </StatusBadge>
                    </p>
                    <p>{formatTimestamp(approval.approvedAt)}</p>
                    <button
                      className={styles.proof}
                      onClick={() => setSelected(approval.evidence)}
                    >
                      View approval email
                    </button>
                  </div>
                ))}
              </Card>
              <Card>
                <h2>Claim status</h2>
                <ClaimLink tripId={id} />
              </Card>
            </div>
            {item.sourceNotes.length > 0 && (
              <Card>
                <h2>Source reconciliation notes</h2>
                <ul className={styles.notes}>
                  {item.sourceNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </Card>
            )}
            <QueryContent query={expenses}>
              {(records) => (
                <ExpenseList
                  expenses={records}
                  evidence={evidence.isError ? [] : (evidence.data ?? [])}
                  onOpen={setSelected}
                />
              )}
            </QueryContent>
            {selected && (
              <EvidenceDrawer
                id={selected}
                evidence={evidence.isError ? [] : (evidence.data ?? [])}
                expenses={expenses.isError ? undefined : expenses.data}
                onClose={() => setSelected(null)}
                onSelect={setSelected}
              />
            )}
          </div>
        )}
      </QueryContent>
    </>
  );
}
