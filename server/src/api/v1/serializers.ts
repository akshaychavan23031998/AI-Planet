import type {
  StoredClaim,
  StoredEvidence,
  StoredExpense,
  StoredTravel,
} from '../../domain/claims/claimPolicyContext.js';
import type { submitClaim } from '../../domain/claims/claimWorkflow.service.js';
import type { evaluateClaimPolicy } from '../../domain/policy/evaluateClaim.js';

type EmployeeSummary = {
  _id: { toString(): string };
  employeeCode: string;
  name: string;
  organizationalRole: string;
};
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;
const reference = (value: { toString(): string } | null | undefined) =>
  value?.toString() ?? null;
const relative = (value: string | null | undefined) =>
  value &&
  !value.startsWith('/') &&
  !value.includes(':') &&
  !value.includes('\\') &&
  !value.split('/').includes('..')
    ? value
    : null;
export function serializeEmployee(employee: EmployeeSummary) {
  return {
    id: employee._id.toString(),
    employeeCode: employee.employeeCode,
    name: employee.name,
    organizationalRole: employee.organizationalRole,
  };
}
export function serializeTravel(
  travel: StoredTravel,
  employee: EmployeeSummary,
) {
  return {
    id: travel._id.toString(),
    travelRequestId: travel.travelRequestId ?? null,
    employee: serializeEmployee(employee),
    origin: travel.origin,
    destination: travel.destination,
    startDate: travel.startDate,
    endDate: travel.endDate,
    purpose: travel.purpose,
    travelType: travel.travelType,
    costCentre: travel.costCentre,
    currency: travel.currency,
    estimatedSpendMinor: travel.estimatedSpendMinor,
    advanceRequestedMinor: travel.advanceRequestedMinor,
    advanceDisbursedMinor: travel.advanceDisbursedMinor,
    advanceReference: travel.advanceReference ?? null,
    advanceDisbursedDate: travel.advanceDisbursedDate ?? null,
    advanceNotifiedAt: iso(travel.advanceNotifiedAt),
    plannedLodgingNights: travel.plannedLodgingNights,
    evidencedLodgingNights: travel.evidencedLodgingNights ?? null,
    preTravelApprovals: travel.preTravelApprovals.map((item) => ({
      approver: item.approver.toString(),
      role: item.role,
      decision: item.decision,
      approvedAt: iso(item.approvedAt),
      evidence: item.evidence.toString(),
    })),
    sourceNotes: [...travel.sourceNotes],
  };
}
const address = (
  value: { name?: string | null; address: string } | null | undefined,
) => (value ? { name: value.name ?? null, address: value.address } : null);
export function serializeEvidence(item: StoredEvidence) {
  const metadata = item.receiptMetadata;
  return {
    id: item._id.toString(),
    travelRequest: item.travelRequest.toString(),
    kind: item.kind,
    classification: item.classification,
    sourceFilename: item.sourceFilename,
    sourceRelativePath: relative(item.sourceRelativePath),
    mimeType: item.mimeType,
    messageId: item.messageId ?? null,
    subject: item.subject ?? null,
    sender: address(item.sender),
    to: item.to.map(address),
    cc: item.cc.map(address),
    receivedAt: iso(item.receivedAt),
    bodyText: item.bodyText ?? null,
    contentHashSha256: item.contentHashSha256,
    parentEvidence: reference(item.parentEvidence),
    relationships: item.relationships.map((relation) => ({
      type: relation.type,
      evidence: relation.evidence.toString(),
    })),
    attachments: item.attachments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sourceRelativePath: relative(attachment.sourceRelativePath),
      representation: attachment.representation,
    })),
    assetReference: relative(item.assetReference),
    metadata: metadata
      ? {
          method: metadata.method,
          canonicalReference: relative(metadata.canonicalReference),
          merchant: metadata.merchant,
          documentNumber: metadata.documentNumber,
          gstin: metadata.gstin ?? null,
          currency: metadata.currency,
          totalMinor: metadata.totalMinor,
          subtotalMinor: metadata.subtotalMinor,
          receiptDate: metadata.receiptDate ?? null,
          occurredAt: iso(metadata.occurredAt),
          covers: metadata.covers ?? null,
          attendeeOrganization: metadata.attendeeOrganization ?? null,
          guestName: metadata.guestName ?? null,
          checkInAt: iso(metadata.checkInAt),
          checkOutAt: iso(metadata.checkOutAt),
          nights: metadata.nights ?? null,
          room: metadata.room ?? null,
          balanceDueMinor: metadata.balanceDueMinor ?? null,
          lines: metadata.lines.map((line) => ({
            description: line.description,
            amountMinor: line.amountMinor,
            date: line.date ?? null,
            quantity: line.quantity ?? null,
          })),
        }
      : null,
  };
}
export function serializeExpense(item: StoredExpense) {
  const details = item.details;
  return {
    id: item._id.toString(),
    travelRequest: item.travelRequest.toString(),
    employee: item.employee.toString(),
    category: item.category,
    componentType: item.componentType,
    expenseDate: item.expenseDate ?? null,
    occurredAt: iso(item.occurredAt),
    merchant: item.merchant,
    description: item.description,
    amountMinor: item.amountMinor,
    currency: item.currency,
    paidBy: item.paidBy,
    sourceReviewState: item.sourceReviewState,
    sourceReviewNote: item.sourceReviewNote ?? null,
    sourceEvidence: item.sourceEvidence.map((id) => id.toString()),
    details: details
      ? {
          origin: details.origin ?? null,
          destination: details.destination ?? null,
          flightNumber: details.flightNumber ?? null,
          pnr: details.pnr ?? null,
          bookingReference: details.bookingReference ?? null,
          invoiceNumber: details.invoiceNumber ?? null,
          paymentMethod: details.paymentMethod ?? null,
          covers: details.covers ?? null,
          attendeeOrganization: details.attendeeOrganization ?? null,
          baseFareMinor: details.baseFareMinor ?? null,
          taxesAndFeesMinor: details.taxesAndFeesMinor ?? null,
          airportSurchargeMinor: details.airportSurchargeMinor ?? null,
        }
      : null,
  };
}
const resolutionView = (
  resolution:
    | { reimbursableMinor: number; disallowedMinor: number; reason: string }
    | null
    | undefined,
) =>
  resolution
    ? {
        reimbursableMinor: resolution.reimbursableMinor,
        disallowedMinor: resolution.disallowedMinor,
        reason: resolution.reason,
      }
    : null;
export function serializeClaim(claim: StoredClaim, employee: EmployeeSummary) {
  const finance = claim.finance;
  return {
    id: claim._id.toString(),
    employee: serializeEmployee(employee),
    travelRequest: claim.travelRequest.toString(),
    currency: claim.currency,
    status: claim.status,
    reviewCycle: claim.reviewCycle ?? 0,
    workflowVersion: claim.workflowVersion ?? 0,
    expenseCount: claim.expenses.length,
    approvals: claim.approvals.map((item) => ({
      level: item.level,
      approver: item.approver.toString(),
      decision: item.decision,
      decidedAt: iso(item.decidedAt),
      remarks: item.remarks ?? null,
      reviewCycle: item.reviewCycle,
    })),
    workflowHistory: [...(claim.workflowHistory ?? [])]
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((item) => ({
        action: item.action,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        actor: item.actor.toString(),
        actorRole: item.actorRole,
        occurredAt: iso(item.occurredAt),
        remarks: item.remarks ?? null,
        reviewCycle: item.reviewCycle,
      })),
    finance: finance
      ? {
          verifiedBy: reference(finance.verifiedBy),
          verifiedAt: iso(finance.verifiedAt),
          reviewCycle: finance.reviewCycle,
          paymentScheduledFor: finance.paymentScheduledFor ?? null,
          paymentScheduledBy: reference(finance.paymentScheduledBy),
          paidAt: iso(finance.paidAt),
          paymentReference: finance.paymentReference ?? null,
        }
      : null,
    reviewRoute: (claim.reviewRoute ?? []).map((item) => ({
      level: item.level,
      employeeId: item.employeeId.toString(),
    })),
    expenseReviews: [...(claim.expenseReviews ?? [])]
      .sort((a, b) => a.expense.toString().localeCompare(b.expense.toString()))
      .map((item) => ({
        expense: item.expense.toString(),
        included: item.included,
        exclusionReason: item.exclusionReason ?? null,
        manualResolution: resolutionView(item.manualResolution),
        updatedBy: item.updatedBy.toString(),
        updatedAt: iso(item.updatedAt),
      })),
    expenseReviewHistory: [...(claim.expenseReviewHistory ?? [])]
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((item) => ({
        action: item.action,
        expense: item.expense.toString(),
        actor: item.actor.toString(),
        occurredAt: iso(item.occurredAt),
        reason: item.reason ?? null,
        resolution: resolutionView(item.resolution),
      })),
  };
}
export function serializeSettlement(
  policy: ReturnType<typeof evaluateClaimPolicy>,
) {
  return {
    employeePaidGrossMinor: policy.employeePaidGrossMinor,
    companyPaidGrossMinor: policy.companyPaidGrossMinor,
    knownEligibleMinor: policy.knownEligibleMinor,
    knownDisallowedMinor: policy.knownDisallowedMinor,
    unresolvedMinor: policy.unresolvedMinor,
    excludedMinor: policy.excludedMinor,
    advanceMinor: policy.advanceMinor,
    payableMinor: policy.payableMinor,
    recoverableMinor: policy.recoverableMinor,
    isFinal: policy.isFinal,
  };
}
export function serializeWorkflow(
  result: Awaited<ReturnType<typeof submitClaim>>,
) {
  const event = result.workflowEvent;
  return {
    claimId: result.claimId,
    action: result.action,
    previousStatus: result.previousStatus,
    currentStatus: result.currentStatus,
    reviewCycle: result.reviewCycle,
    actor: {
      id: result.actor.employeeId,
      employeeCode: result.actor.employeeCode,
      name: result.actor.name,
      organizationalRole: result.actor.organizationalRole,
    },
    workflowEvent: {
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actor: event.actor,
      actorRole: event.actorRole,
      occurredAt: iso(event.occurredAt),
      remarks: event.remarks ?? null,
      reviewCycle: event.reviewCycle,
    },
    settlementDirection: result.settlementDirection,
  };
}
