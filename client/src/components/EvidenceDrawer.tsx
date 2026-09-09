import { useEffect, useRef } from 'react';
import { FileImage, X } from 'lucide-react';
import type { EmailAddress, Evidence, Expense } from '../api/types';
import { useEvidenceDetail } from '../app/queries';
import { QueryContent } from './TripSummaryCard';
import { StatusBadge } from './ui';
import {
  classificationLabels,
  classificationVariant,
} from './evidencePresentation';
import {
  formatDateOnly,
  formatMoneyMinor,
  formatTimestamp,
  readable,
} from '../utils/format';
import styles from './workspace.module.css';
function address(value: EmailAddress) {
  return value
    ? value.name
      ? `${value.name} <${value.address}>`
      : value.address
    : 'Not available';
}
export function EvidenceDrawer({
  id,
  evidence,
  expenses,
  onClose,
  onSelect,
}: {
  id: string;
  evidence: Evidence[];
  expenses: Expense[] | undefined;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useEvidenceDetail(id);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    element?.querySelector('button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  function related(target: string, label: string) {
    const item = evidence.find((entry) => entry.id === target);
    return (
      <button className={styles.proof} onClick={() => onSelect(target)}>
        {label}: {item?.subject ?? item?.sourceFilename ?? 'Related evidence'}
      </button>
    );
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="evidence-detail-title"
      className={styles.drawer}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className={styles.drawerHeader}>
        <h2 id="evidence-detail-title">Evidence detail</h2>
        <button aria-label="Close evidence" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.drawerBody}>
        <QueryContent query={detail}>
          {(item) => (
            <>
              <StatusBadge variant={classificationVariant(item.classification)}>
                {classificationLabels[item.classification]}
              </StatusBadge>
              <h3>{item.subject ?? item.sourceFilename}</h3>
              <dl className={styles.facts}>
                <div>
                  <dt>Kind</dt>
                  <dd>{readable(item.kind)}</dd>
                </div>
                <div>
                  <dt>Source filename</dt>
                  <dd>{item.sourceFilename}</dd>
                </div>
                <div>
                  <dt>Source reference</dt>
                  <dd>{item.sourceRelativePath ?? 'Not available'}</dd>
                </div>
                <div>
                  <dt>File type</dt>
                  <dd>{item.mimeType}</dd>
                </div>
                {item.kind === 'EMAIL' && (
                  <>
                    <div>
                      <dt>From</dt>
                      <dd>{address(item.sender)}</dd>
                    </div>
                    <div>
                      <dt>To</dt>
                      <dd>
                        {item.to.map(address).join(', ') || 'Not available'}
                      </dd>
                    </div>
                    <div>
                      <dt>CC</dt>
                      <dd>
                        {item.cc.map(address).join(', ') || 'None recorded'}
                      </dd>
                    </div>
                    <div>
                      <dt>Received</dt>
                      <dd>{formatTimestamp(item.receivedAt)}</dd>
                    </div>
                    <div>
                      <dt>Message reference</dt>
                      <dd>{item.messageId ?? 'Not available'}</dd>
                    </div>
                  </>
                )}
              </dl>
              {item.bodyText && (
                <section>
                  <h3>Email body</h3>
                  <p className={styles.bodyText}>{item.bodyText}</p>
                </section>
              )}
              {(item.kind === 'IMAGE' ||
                item.assetReference ||
                item.attachments.length > 0) && (
                <section className={styles.attachment}>
                  <FileImage aria-hidden="true" size={24} />
                  <h3>Receipt attachment</h3>
                  <p>
                    File metadata is available. Image preview is not available.
                  </p>
                  <p>{item.assetReference ?? item.sourceRelativePath}</p>
                  {item.attachments.map((attachment) => (
                    <p key={attachment.filename}>
                      {attachment.filename} · {attachment.mimeType}
                      <br />
                      {attachment.sourceRelativePath}
                    </p>
                  ))}
                </section>
              )}
              {item.metadata && (
                <section>
                  <h3>Receipt details</h3>
                  <p className={styles.muted}>Pre-extracted source metadata</p>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Merchant</dt>
                      <dd>{item.metadata.merchant}</dd>
                    </div>
                    <div>
                      <dt>Document</dt>
                      <dd>{item.metadata.documentNumber}</dd>
                    </div>
                    <div>
                      <dt>Receipt date</dt>
                      <dd>{formatDateOnly(item.metadata.receiptDate)}</dd>
                    </div>
                    <div>
                      <dt>Source total</dt>
                      <dd>
                        {formatMoneyMinor(
                          item.metadata.totalMinor,
                          item.metadata.currency,
                        )}
                      </dd>
                    </div>
                    {item.metadata.covers != null && (
                      <div>
                        <dt>Covers</dt>
                        <dd>{item.metadata.covers}</dd>
                      </div>
                    )}
                    {item.metadata.attendeeOrganization && (
                      <div>
                        <dt>Attendee organization</dt>
                        <dd>{item.metadata.attendeeOrganization}</dd>
                      </div>
                    )}
                    {item.metadata.guestName && (
                      <div>
                        <dt>Guest</dt>
                        <dd>{item.metadata.guestName}</dd>
                      </div>
                    )}
                    {item.metadata.nights != null && (
                      <div>
                        <dt>Evidenced nights</dt>
                        <dd>{item.metadata.nights}</dd>
                      </div>
                    )}
                  </dl>
                  {item.metadata.lines.map((line, index) => (
                    <p key={index}>
                      {line.description} ·{' '}
                      {formatMoneyMinor(
                        line.amountMinor,
                        item.metadata!.currency,
                      )}
                    </p>
                  ))}
                </section>
              )}
              <section>
                <h3>Related evidence</h3>
                {item.parentEvidence &&
                  related(item.parentEvidence, 'Parent email')}
                {item.relationships.map((relation) => (
                  <div key={`${relation.type}-${relation.evidence}`}>
                    {related(relation.evidence, readable(relation.type))}
                  </div>
                ))}
                {!item.parentEvidence && !item.relationships.length && (
                  <p>No relationships recorded.</p>
                )}
              </section>
              <section>
                <h3>Linked source expenses</h3>
                {!expenses && (
                  <p>
                    Expense links are not available yet. Return to the trip to
                    load or retry expenses.
                  </p>
                )}
                {expenses
                  ?.filter((expense) =>
                    expense.sourceEvidence.includes(item.id),
                  )
                  .map((expense) => (
                    <div className={styles.linkedExpense} key={expense.id}>
                      <strong>{expense.merchant}</strong>
                      <p>{expense.description}</p>
                      <span>
                        {formatMoneyMinor(
                          expense.amountMinor,
                          expense.currency,
                        )}{' '}
                        · {readable(expense.paidBy)} paid
                      </span>
                      {expense.sourceReviewNote && (
                        <p>{expense.sourceReviewNote}</p>
                      )}
                    </div>
                  ))}
                {expenses &&
                  !expenses.some((expense) =>
                    expense.sourceEvidence.includes(item.id),
                  ) && <p>No normalized expense linked to this evidence.</p>}
              </section>
            </>
          )}
        </QueryContent>
      </div>
    </dialog>
  );
}
