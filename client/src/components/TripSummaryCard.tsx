import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from './ui';
import { useClaims, useEvidence } from '../app/queries';
import type { TravelRequest } from '../api/types';
import { formatDateOnly, formatMoneyMinor, readable } from '../utils/format';
import styles from './workspace.module.css';
export function QueryContent<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  if (query.isPending) return <LoadingState />;
  return children(query.data);
}
export function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note: string;
}) {
  return (
    <Card>
      <div className={styles.summary}>
        <div className={styles.eyebrow}>{label}</div>
        <div className={styles.value}>{value}</div>
        <p className={styles.muted}>{note}</p>
      </div>
    </Card>
  );
}
export function ClaimLink({ tripId }: { tripId: string }) {
  const claims = useClaims();
  return (
    <QueryContent query={claims}>
      {(items) => {
        const related = items.filter((claim) => claim.travelRequest === tripId);
        return related.length ? (
          <div className={styles.actions}>
            {related.map((claim) => (
              <span key={claim.id}>
                <StatusBadge variant="info">
                  {readable(claim.status)}
                </StatusBadge>{' '}
                <Link to={`/claims/${claim.id}`}>Review claim</Link>
              </span>
            ))}
          </div>
        ) : (
          <EmptyState title="No related claim">
            No claim is available for this trip.
          </EmptyState>
        );
      }}
    </QueryContent>
  );
}
export function TripSummaryCard({ trip }: { trip: TravelRequest }) {
  const evidence = useEvidence(trip.id);
  return (
    <Card>
      <div className={styles.hero}>
        <div>
          <StatusBadge variant="info">{readable(trip.travelType)}</StatusBadge>{' '}
          {!trip.travelRequestId && (
            <StatusBadge variant="warning">
              Travel Request ID missing
            </StatusBadge>
          )}
          <h2 className={styles.route}>
            {trip.origin} → {trip.destination}
          </h2>
          <p>
            {formatDateOnly(trip.startDate)} – {formatDateOnly(trip.endDate)}
          </p>
          <p>{trip.purpose}</p>
          <p className={styles.muted}>
            {trip.employee.name} · {trip.employee.employeeCode} · Cost centre{' '}
            {trip.costCentre}
          </p>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Estimated spend</dt>
            <dd>{formatMoneyMinor(trip.estimatedSpendMinor, trip.currency)}</dd>
          </div>
          <div>
            <dt>Advance disbursed</dt>
            <dd>
              {formatMoneyMinor(trip.advanceDisbursedMinor, trip.currency)}
            </dd>
          </div>
        </dl>
      </div>
      <div className={styles.footer}>
        <QueryContent query={evidence}>
          {(items) => (
            <span>
              {items.length} evidence records ·{' '}
              {items.filter((item) => item.kind === 'EMAIL').length} emails ·{' '}
              {items.filter((item) => item.kind === 'IMAGE').length} receipt
              attachments
            </span>
          )}
        </QueryContent>
        <div className={styles.actions}>
          <Link to={`/trips/${trip.id}`}>Open trip</Link>
          <Link to={`/trips/${trip.id}/evidence`}>Review evidence</Link>
        </div>
        <ClaimLink tripId={trip.id} />
      </div>
    </Card>
  );
}
