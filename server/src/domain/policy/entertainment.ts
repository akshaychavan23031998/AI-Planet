import { approvalProvenBefore } from './approvals.js';
import { finding } from './findings.js';
import { assertMinor, isBusinessDate, timestamp } from './money.js';
import type {
  AmountEvaluation,
  PolicyEvidence,
  PolicyExpense,
  PolicyFinding,
} from './types.js';

export function evaluateEntertainment(
  expense: PolicyExpense,
  evidence: readonly PolicyEvidence[],
): AmountEvaluation {
  assertMinor(expense.amountMinor);
  const findings: PolicyFinding[] = [];
  const context = {
    expenseKey: expense.key,
    evidenceKeys: expense.evidenceKeys,
  };
  const attendees = expense.attendees ?? [];
  const named =
    attendees.length > 0 &&
    attendees.every((item) => item.name.trim()) &&
    new Set(attendees.map((item) => item.name.trim().toLowerCase())).size ===
      attendees.length &&
    (expense.covers === undefined || attendees.length === expense.covers);
  if (!named)
    findings.push(
      finding(
        'BUSINESS_ENTERTAINMENT_ATTENDEE_NAMES_MISSING',
        'BLOCKING',
        'Provide individual attendee names matching the known covers; an organisation label alone is insufficient.',
        '§3.5',
        context,
      ),
    );
  if (
    (attendees.length > 0 &&
      attendees.some((item) => !item.organisation.trim())) ||
    (attendees.length === 0 && !expense.attendeeOrganisation?.trim())
  )
    findings.push(
      finding(
        'BUSINESS_ENTERTAINMENT_ORGANISATIONS_MISSING',
        'BLOCKING',
        'Provide attendee organisations.',
        '§3.5',
        context,
      ),
    );
  const before = expense.occurredAt
    ? timestamp(expense.occurredAt)
    : isBusinessDate(expense.expenseDate)
      ? timestamp(`${expense.expenseDate}T00:00:00+05:30`)
      : null;
  if (
    expense.amountMinor > 200000 &&
    (!expense.entertainmentApproval ||
      expense.entertainmentApproval.level !== 'HEAD_OF_DEPARTMENT' ||
      before === null ||
      !approvalProvenBefore(expense.entertainmentApproval, before, evidence))
  )
    findings.push(
      finding(
        'BUSINESS_ENTERTAINMENT_HOD_APPROVAL_MISSING',
        'BLOCKING',
        'Prior HOD entertainment approval above INR 2,000 is not proven.',
        '§3.5',
        context,
      ),
    );
  return {
    knownEligibleMinor: findings.length ? 0 : expense.amountMinor,
    knownDisallowedMinor: 0,
    unresolvedMinor: findings.length ? expense.amountMinor : 0,
    findings,
  };
}
