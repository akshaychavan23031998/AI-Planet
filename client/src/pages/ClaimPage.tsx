import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useClaim,
  useClaimValidation,
  useClaimReadiness,
  useClaimSettlement,
  useClaimMutation,
  claimMutationMessage,
} from '../app/claimQueries';
import type { ClaimCommand } from '../app/claimQueries';
import { useEvidence, useExpenses } from '../app/queries';
import { useDemoIdentity } from '../context/demoIdentity';
import type { Claim } from '../api/claimTypes';
import type { Expense } from '../api/types';
import { Card, PageHeader, LoadingState, StatusBadge } from '../components/ui';
import { QueryContent } from '../components/TripSummaryCard';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { PolicyFindingList } from '../components/claims/PolicyFindingList';
import { SettlementSummary } from '../components/claims/SettlementSummary';
import { ClaimTimeline } from '../components/claims/ClaimTimeline';
import { ClaimExpenseList } from '../components/claims/ClaimExpenseList';
import { ClaimDecisionDialog } from '../components/claims/ClaimDecisionDialog';
import { readable } from '../utils/format';
import { NotFoundPage } from './pages';
import styles from '../components/claims/claims.module.css';
export function ClaimPage() {
  const { claimId } = useParams();
  if (!claimId || !/^[a-fA-F0-9]{24}$/.test(claimId)) return <NotFoundPage />;
  return <ClaimContent key={claimId} id={claimId} />;
}
function ClaimContent({ id }: { id: string }) {
  const claim = useClaim(id);
  return (
    <>
      <PageHeader
        title="Expense Claim"
        description="Review source expenses, policy findings and settlement before sending your claim for approval."
      />
      <QueryContent query={claim}>
        {(item) => (
          <ClaimWorkspace claim={item} refreshingClaim={claim.isFetching} />
        )}
      </QueryContent>
    </>
  );
}
function ClaimWorkspace({
  claim,
  refreshingClaim,
}: {
  claim: Claim;
  refreshingClaim: boolean;
}) {
  const validation = useClaimValidation(claim.id);
  const readiness = useClaimReadiness(claim.id);
  const settlement = useClaimSettlement(claim.id);
  const expenses = useExpenses(claim.travelRequest);
  const evidence = useEvidence(claim.travelRequest);
  const mutation = useClaimMutation(claim.id);
  const { selectedEmployeeCode } = useDemoIdentity();
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    expense: Expense;
    action: 'exclude' | 'resolve';
  } | null>(null);
  const actionLock = useRef(false);
  const editable =
    selectedEmployeeCode === claim.employee.employeeCode &&
    ['DRAFT', 'RETURNED'].includes(claim.status);
  const refreshing =
    refreshingClaim ||
    validation.isFetching ||
    readiness.isFetching ||
    settlement.isFetching;
  const canAct =
    editable &&
    !refreshing &&
    validation.isSuccess &&
    readiness.isSuccess &&
    settlement.isSuccess &&
    !mutation.isPending;
  const sources = evidence.isError ? [] : (evidence.data ?? []);
  const records = expenses.isError ? [] : (expenses.data ?? []);
  async function act(command: ClaimCommand) {
    if (actionLock.current || !canAct) return;
    actionLock.current = true;
    try {
      await mutation.mutateAsync(command);
      setDecision(null);
    } catch {
      /* The mutation error remains visible beside the relevant action. */
    } finally {
      actionLock.current = false;
    }
  }
  const lastReturn = [...claim.workflowHistory]
    .reverse()
    .find((event) => event.action === 'RETURNED');
  return (
    <div className={styles.stack}>
      <Card>
        <div className={styles.panel}>
          <div className={styles.heading}>
            <div>
              <StatusBadge
                variant={claim.status === 'RETURNED' ? 'warning' : 'info'}
              >
                {readable(claim.status)}
              </StatusBadge>
              <h2>{claim.employee.name}</h2>
              <p>
                {claim.employee.employeeCode} · {claim.currency} · Review cycle{' '}
                {claim.reviewCycle} · {claim.expenseCount} source expenses
              </p>
            </div>
            <Link to={`/trips/${claim.travelRequest}`}>View trip</Link>
          </div>
          <p className={styles.muted}>
            {editable
              ? 'Review decisions can be edited while this claim is draft or returned. Source records stay unchanged.'
              : 'This claim is read-only for your identity and its current workflow stage.'}
          </p>
          {claim.status === 'RETURNED' && (
            <div className={styles.returned}>
              <strong>Latest return remarks</strong>
              <p>{lastReturn?.remarks ?? 'No return remarks recorded.'}</p>
            </div>
          )}
        </div>
      </Card>
      {mutation.error && !decision && (
        <p role="alert" className={styles.error}>
          {claimMutationMessage(mutation.error)}
        </p>
      )}
      {!mutation.isPending && refreshing && (
        <LoadingState label="Refreshing claim evaluation…" />
      )}
      {mutation.isPending && (
        <LoadingState label="Updating claim and refreshing policy, readiness and settlement…" />
      )}
      {!mutation.isPending && !refreshing && (
        <QueryContent query={validation}>
          {(data) => (
            <Card>
              <div className={styles.panel}>
                <h2>Policy and attention</h2>
                <p>
                  Backend approval route:{' '}
                  {data.requiredClaimApprovalLevels.map(readable).join(' → ') ||
                    'Not available'}
                  {data.claimApprovalBasisIsProvisional
                    ? ' · Provisional basis'
                    : ''}
                </p>
                <PolicyFindingList
                  findings={data.findings}
                  evidence={sources}
                  expenses={records}
                  onEvidence={setSelectedEvidence}
                />
              </div>
            </Card>
          )}
        </QueryContent>
      )}
      <QueryContent query={expenses}>
        {(items) => (
          <QueryContent query={validation}>
            {(data) => (
              <ClaimExpenseList
                claim={claim}
                validation={data}
                expenses={items}
                evidence={sources}
                editable={editable}
                pending={!canAct}
                onEvidence={setSelectedEvidence}
                onDecision={(expense, action) => {
                  mutation.reset();
                  setDecision({ expense, action });
                }}
                onRestore={(expenseId) =>
                  void act({ action: 'restore', expenseId })
                }
              />
            )}
          </QueryContent>
        )}
      </QueryContent>
      {!mutation.isPending && !refreshing && (
        <div className={styles.columns}>
          <QueryContent query={settlement}>
            {(data) => <SettlementSummary settlement={data} />}
          </QueryContent>
          <QueryContent query={readiness}>
            {(data) => (
              <Card>
                <div className={styles.panel}>
                  <h2>Submission readiness</h2>
                  <StatusBadge
                    variant={data.isReadyToSubmit ? 'success' : 'danger'}
                  >
                    {data.isReadyToSubmit
                      ? 'Ready to submit'
                      : 'Not ready to submit'}
                  </StatusBadge>
                  <p>
                    {data.blockingIssues.length} blocking ·{' '}
                    {data.warnings.length} warnings ·{' '}
                    {data.informational.length} informational
                  </p>
                  <PolicyFindingList
                    findings={data.blockingIssues}
                    evidence={sources}
                    expenses={records}
                    onEvidence={setSelectedEvidence}
                  />
                  <details>
                    <summary>Warnings and information</summary>
                    <PolicyFindingList
                      findings={[...data.warnings, ...data.informational]}
                      evidence={sources}
                      expenses={records}
                      onEvidence={setSelectedEvidence}
                    />
                  </details>
                  {editable && (
                    <>
                      <p className={styles.muted}>
                        Sending the claim starts business review. It does not
                        complete approval or payment. The backend chooses the
                        review route.
                      </p>
                      <button
                        className={styles.primary}
                        disabled={!canAct || !data.isReadyToSubmit}
                        onClick={() =>
                          void act({
                            action:
                              claim.status === 'RETURNED'
                                ? 'resubmit'
                                : 'submit',
                          })
                        }
                      >
                        {claim.status === 'RETURNED'
                          ? 'Resubmit claim'
                          : 'Submit claim'}
                      </button>
                    </>
                  )}
                </div>
              </Card>
            )}
          </QueryContent>
        </div>
      )}
      <ClaimTimeline claim={claim} />
      {selectedEvidence && (
        <EvidenceDrawer
          id={selectedEvidence}
          evidence={sources}
          expenses={expenses.isError ? undefined : expenses.data}
          onClose={() => setSelectedEvidence(null)}
          onSelect={setSelectedEvidence}
        />
      )}
      {decision && (
        <ClaimDecisionDialog
          expense={decision.expense}
          action={decision.action}
          pending={mutation.isPending}
          error={mutation.error}
          onClose={() => {
            setDecision(null);
            mutation.reset();
          }}
          onSave={act}
        />
      )}
    </div>
  );
}
