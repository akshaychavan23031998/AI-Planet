import { assertMinor, timestamp } from './money.js';
import { finding } from './findings.js';
import type {
  ApprovalLevel,
  PolicyApproval,
  PolicyEvidence,
  PolicyFinding,
  PolicyInput,
  TravelType,
} from './types.js';

export function requiredApprovalLevels(
  claimedMinor: number,
  travelType: TravelType,
): ApprovalLevel[] {
  assertMinor(claimedMinor);
  if (!['DOMESTIC', 'INTERNATIONAL'].includes(travelType))
    throw new TypeError('Unsupported travel type');
  // Convention: even one paise above an upper threshold enters the next band.
  const levels: ApprovalLevel[] = ['REPORTING_MANAGER'];
  if (claimedMinor > 2500000 || travelType === 'INTERNATIONAL')
    levels.push('HEAD_OF_DEPARTMENT');
  if (claimedMinor > 7500000 || travelType === 'INTERNATIONAL')
    levels.push('HEAD_OF_DIVISION');
  if (claimedMinor > 20000000 || travelType === 'INTERNATIONAL')
    levels.push('MANAGING_DIRECTOR');
  return levels;
}
export function approvalProvenBefore(
  approval: PolicyApproval,
  before: number,
  evidence: readonly PolicyEvidence[],
): boolean {
  return (
    approval.decision === 'APPROVED' &&
    timestamp(approval.approvedAt) < before &&
    evidence.some(
      (item) =>
        item.key === approval.evidenceKey && item.classification === 'APPROVAL',
    )
  );
}
export function evaluatePreTravelApprovals(
  travel: PolicyInput['travel'],
  evidence: readonly PolicyEvidence[],
) {
  const requiredLevels = requiredApprovalLevels(
    travel.estimatedSpendMinor,
    travel.travelType,
  );
  const before = timestamp(
    `${travel.bookingDate ?? travel.startDate}T00:00:00+05:30`,
  );
  const proven = new Set(
    travel.preTravelApprovals
      .filter((item) => approvalProvenBefore(item, before, evidence))
      .map((item) => item.level),
  );
  const findings: PolicyFinding[] = [];
  if (
    !travel.travelRequestId?.trim() ||
    travel.travelRequestId === 'TRQ-2026-0000'
  )
    findings.push(
      finding(
        'MISSING_TRAVEL_REQUEST_ID',
        'WARNING',
        'Actual Travel Request ID is absent. Confirm from authoritative records; never invent an ID.',
        '§1.1',
        { historicalException: true },
      ),
    );
  for (const level of requiredLevels.filter((item) => !proven.has(item)))
    findings.push(
      finding(
        level === 'HEAD_OF_DEPARTMENT'
          ? 'MISSING_PRETRAVEL_HOD_APPROVAL'
          : 'MISSING_PRETRAVEL_APPROVAL',
        'WARNING',
        `Required historical ${level} approval is not proven before booking/travel.`,
        '§1.1 / §2',
        { historicalException: true, metadata: { level } },
      ),
    );
  return { requiredLevels, findings };
}
