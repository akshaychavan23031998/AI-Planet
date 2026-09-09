import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, FileImage, Paperclip } from 'lucide-react';
import { useEvidence, useExpenses } from '../app/queries';
import { QueryContent } from '../components/TripSummaryCard';
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import {
  classificationLabels,
  classificationVariant,
} from '../components/evidencePresentation';
import { formatMoneyMinor, formatTimestamp } from '../utils/format';
import type { Evidence } from '../api/types';
import { NotFoundPage } from './pages';
import styles from '../components/workspace.module.css';
export function EvidencePage() {
  const { travelRequestId } = useParams();
  if (!travelRequestId || !/^[a-fA-F0-9]{24}$/.test(travelRequestId))
    return <NotFoundPage />;
  return <EvidenceContent key={travelRequestId} id={travelRequestId} />;
}
function EvidenceContent({ id }: { id: string }) {
  const evidence = useEvidence(id);
  const expenses = useExpenses(id);
  const [classification, setClassification] = useState('ALL');
  const [kind, setKind] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  function amount(item: Evidence) {
    if (item.metadata)
      return formatMoneyMinor(item.metadata.totalMinor, item.metadata.currency);
    if (expenses.isError || !expenses.data) return 'Amount not available';
    const linked = expenses.data.filter((expense) =>
      expense.sourceEvidence.includes(item.id),
    );
    return linked.length
      ? formatMoneyMinor(
          linked.reduce((sum, expense) => sum + expense.amountMinor, 0),
        )
      : 'No linked expense';
  }
  return (
    <>
      <PageHeader
        title="Evidence"
        description="All supplied sources remain visible, including duplicates, failed payments and unrelated messages."
      />
      <div className={styles.actions}>
        <Link to={`/trips/${id}`}>Back to trip</Link>
      </div>
      <QueryContent query={evidence}>
        {(items) => {
          const filtered = items.filter(
            (item) =>
              (classification === 'ALL' ||
                item.classification === classification) &&
              (kind === 'ALL' || item.kind === kind) &&
              [
                item.subject,
                item.sender?.name,
                item.sender?.address,
                item.sourceFilename,
                classificationLabels[item.classification],
              ]
                .join(' ')
                .toLowerCase()
                .includes(search.trim().toLowerCase()),
          );
          return (
            <div className={styles.stack}>
              {expenses.isError && (
                <ErrorState
                  error={expenses.error}
                  onRetry={() => void expenses.refetch()}
                />
              )}
              <Card>
                <div className={styles.toolbar}>
                  <label>
                    Search evidence
                    <input
                      type="search"
                      placeholder="Subject, sender or filename"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <label>
                    Classification
                    <select
                      value={classification}
                      onChange={(event) =>
                        setClassification(event.target.value)
                      }
                    >
                      <option value="ALL">All classifications</option>
                      {Object.entries(classificationLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Kind
                    <select
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="ALL">All kinds</option>
                      <option value="EMAIL">Email</option>
                      <option value="IMAGE">Image</option>
                    </select>
                  </label>
                  <button
                    onClick={() => {
                      setClassification('ALL');
                      setKind('ALL');
                      setSearch('');
                    }}
                  >
                    Reset filters
                  </button>
                </div>
                <p className={styles.muted} role="status">
                  Showing {filtered.length} of {items.length} evidence records
                </p>
                {!items.length ? (
                  <EmptyState title="No evidence">
                    No evidence is available for this trip.
                  </EmptyState>
                ) : !filtered.length ? (
                  <EmptyState title="No matching evidence">
                    Try another classification or reset the filters.
                  </EmptyState>
                ) : (
                  <ul className={styles.list} aria-label="Evidence records">
                    {filtered.map((item) => (
                      <li className={styles.evidenceRow} key={item.id}>
                        <span className={styles.sourceIcon}>
                          {item.kind === 'EMAIL' ? (
                            <Mail aria-hidden="true" size={20} />
                          ) : (
                            <FileImage aria-hidden="true" size={20} />
                          )}
                        </span>
                        <div>
                          <strong>{item.subject ?? item.sourceFilename}</strong>
                          <p className={styles.muted}>{item.sourceFilename}</p>
                          <small>
                            {item.sender?.name ??
                              item.sender?.address ??
                              'Receipt attachment'}{' '}
                            · {formatTimestamp(item.receivedAt)}
                          </small>
                        </div>
                        <div>
                          <StatusBadge
                            variant={classificationVariant(item.classification)}
                          >
                            {classificationLabels[item.classification]}
                          </StatusBadge>
                          <p className={styles.muted}>
                            {item.kind === 'EMAIL' ? 'Email' : 'Image'}
                            {(item.attachments.length > 0 ||
                              item.assetReference) && (
                              <Paperclip
                                size={13}
                                aria-label="Attachment reference"
                              />
                            )}
                          </p>
                        </div>
                        <div className={styles.amount}>
                          <strong>{amount(item)}</strong>
                          <small>Source value</small>
                        </div>
                        <button
                          aria-label={`Inspect ${item.subject ?? item.sourceFilename}`}
                          onClick={() => setSelected(item.id)}
                        >
                          Inspect
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <p className={styles.callout}>
                Classification preserves source meaning. It does not decide
                policy eligibility or reimbursement.
              </p>
              {selected && (
                <EvidenceDrawer
                  id={selected}
                  evidence={items}
                  expenses={expenses.isError ? undefined : expenses.data}
                  onClose={() => setSelected(null)}
                  onSelect={setSelected}
                />
              )}
            </div>
          );
        }}
      </QueryContent>
    </>
  );
}
