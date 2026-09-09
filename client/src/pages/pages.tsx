import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, PageHeader } from '../components/ui';
function WorkspacePage({
  title,
  description,
  emptyTitle,
  emptyMessage,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyMessage: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState title={emptyTitle}>{emptyMessage}</EmptyState>
      </Card>
    </>
  );
}
export function DashboardPage() {
  return (
    <WorkspacePage
      title="Dashboard"
      description="Your travel and expense workspace."
      emptyTitle="Your workspace is ready"
      emptyMessage="Your trips and expense activity will appear here."
    />
  );
}
export function TripPage() {
  const { travelRequestId } = useParams();
  if (!travelRequestId || !/^[a-fA-F0-9]{24}$/.test(travelRequestId))
    return <NotFoundPage />;
  return (
    <WorkspacePage
      title="Trip"
      description="Travel request overview."
      emptyTitle="Trip workspace"
      emptyMessage="Travel information and supporting records will appear here."
    />
  );
}
export function EvidencePage() {
  const { travelRequestId } = useParams();
  if (!travelRequestId || !/^[a-fA-F0-9]{24}$/.test(travelRequestId))
    return <NotFoundPage />;
  return (
    <WorkspacePage
      title="Evidence"
      description="Supporting records for your trip."
      emptyTitle="Evidence inbox"
      emptyMessage="Emails and receipt references will appear here."
    />
  );
}
export function ClaimPage() {
  const { claimId } = useParams();
  if (!claimId || !/^[a-fA-F0-9]{24}$/.test(claimId)) return <NotFoundPage />;
  return (
    <WorkspacePage
      title="Expense Claim"
      description="Expense review and settlement workspace."
      emptyTitle="Claim workspace"
      emptyMessage="Expense details and review information will appear here."
    />
  );
}
export function ApprovalsPage() {
  return (
    <WorkspacePage
      title="Approvals"
      description="Your assigned business reviews."
      emptyTitle="Approval workspace"
      emptyMessage="Assigned reviews will appear here."
    />
  );
}
export function FinancePage() {
  return (
    <WorkspacePage
      title="Finance"
      description="Verification and payment workspace."
      emptyTitle="Finance workspace"
      emptyMessage="Settlement verification and payment information will appear here."
    />
  );
}
export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="This address does not match a workspace page."
      />
      <Card>
        <EmptyState title="Let’s get you back">
          <Link to="/">Back to Dashboard</Link>
        </EmptyState>
      </Card>
    </>
  );
}
