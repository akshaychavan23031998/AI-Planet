import { formatMoneyMinor } from '../utils/format';
import { useTrips, useExpenses } from '../app/queries';
import { PageHeader, EmptyState } from '../components/ui';
import {
  QueryContent,
  SummaryCard,
  TripSummaryCard,
} from '../components/TripSummaryCard';
import styles from '../components/workspace.module.css';
export function DashboardPage() {
  const trips = useTrips();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your travel, source costs and supporting evidence in one workspace."
      />
      <QueryContent query={trips}>
        {(items) =>
          !items.length ? (
            <EmptyState title="No travel requests">
              There are no travel requests available for this identity.
            </EmptyState>
          ) : (
            <div className={styles.stack}>
              <DashboardSummary
                tripId={items[0]!.id}
                tripCount={items.length}
              />
              <h2 className={styles.sectionTitle}>Recent travel</h2>
              {items.map((trip) => (
                <TripSummaryCard key={trip.id} trip={trip} />
              ))}
            </div>
          )
        }
      </QueryContent>
    </>
  );
}

function DashboardSummary({
  tripId,
  tripCount,
}: {
  tripId: string;
  tripCount: number;
}) {
  const expenses = useExpenses(tripId);
  return (
    <QueryContent query={expenses}>
      {(items) => (
        <div className={styles.summaryGrid}>
          <SummaryCard
            label="Visible travel requests"
            value={tripCount}
            note="Travel records available to your selected identity"
          />
          <SummaryCard
            label="Employee-paid source gross"
            value={formatMoneyMinor(
              items
                .filter((item) => item.paidBy === 'EMPLOYEE')
                .reduce((sum, item) => sum + item.amountMinor, 0),
            )}
            note="Most recent trip · recorded costs, not reimbursement"
          />
          <SummaryCard
            label="Company-paid source gross"
            value={formatMoneyMinor(
              items
                .filter((item) => item.paidBy === 'COMPANY')
                .reduce((sum, item) => sum + item.amountMinor, 0),
            )}
            note="Most recent trip · company costs retained for audit"
          />
        </div>
      )}
    </QueryContent>
  );
}
