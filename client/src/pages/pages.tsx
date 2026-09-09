import { Link } from 'react-router-dom';
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
