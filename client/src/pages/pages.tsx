import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader } from '../components/ui';
import { ReviewWorkspace } from './ReviewWorkspace';
export function ApprovalsPage() {
  return <ReviewWorkspace />;
}
export function FinancePage() {
  return <ReviewWorkspace finance />;
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
