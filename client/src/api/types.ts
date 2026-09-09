import type { ClaimStatus } from './claimTypes';
import type { DemoEmployee } from './demo';
export interface TravelRequest {
  id: string;
  travelRequestId: string | null;
  employee: DemoEmployee;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  purpose: string;
  travelType: 'DOMESTIC' | 'INTERNATIONAL';
  costCentre: string;
  currency: 'INR';
  estimatedSpendMinor: number;
  advanceRequestedMinor: number;
  advanceDisbursedMinor: number;
  advanceReference: string | null;
  advanceDisbursedDate: string | null;
  plannedLodgingNights: number;
  evidencedLodgingNights: number | null;
  preTravelApprovals: {
    approver: string;
    role: string;
    decision: 'APPROVED';
    approvedAt: string | null;
    evidence: string;
  }[];
  sourceNotes: string[];
}
export type Classification =
  | 'SUPPORTING_TRIP'
  | 'APPROVAL'
  | 'ADVANCE'
  | 'COMPANY_PAID_COST'
  | 'EMPLOYEE_PAID_CANDIDATE'
  | 'PAYMENT_FAILURE'
  | 'DUPLICATE'
  | 'NEEDS_REVIEW'
  | 'CLAIMANT_MISMATCH'
  | 'NOISE'
  | 'SUPPORTING_DOCUMENT';
export type EmailAddress = { name: string | null; address: string } | null;
export interface Evidence {
  id: string;
  travelRequest: string;
  kind: 'EMAIL' | 'IMAGE';
  classification: Classification;
  sourceFilename: string;
  sourceRelativePath: string | null;
  mimeType: string;
  messageId: string | null;
  subject: string | null;
  sender: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  receivedAt: string | null;
  bodyText: string | null;
  parentEvidence: string | null;
  relationships: {
    type:
      | 'HAS_REPLY'
      | 'RESOLVED_BY'
      | 'DUPLICATE_OF'
      | 'HAS_ATTACHMENT'
      | 'FINALIZED_BY';
    evidence: string;
  }[];
  attachments: {
    filename: string;
    mimeType: string;
    sourceRelativePath: string | null;
  }[];
  assetReference: string | null;
  metadata: null | {
    merchant: string;
    documentNumber: string;
    currency: 'INR';
    totalMinor: number;
    subtotalMinor: number;
    receiptDate: string | null;
    covers: number | null;
    attendeeOrganization: string | null;
    guestName: string | null;
    nights: number | null;
    lines: {
      description: string;
      amountMinor: number;
      date: string | null;
      quantity: number | null;
    }[];
  };
}
export interface Expense {
  id: string;
  category:
    | 'AIR_TRAVEL'
    | 'LODGING'
    | 'LOCAL_CONVEYANCE'
    | 'MEAL'
    | 'BUSINESS_ENTERTAINMENT'
    | 'OTHER';
  componentType: string;
  expenseDate: string | null;
  merchant: string;
  description: string;
  amountMinor: number;
  currency: 'INR';
  paidBy: 'EMPLOYEE' | 'COMPANY';
  sourceReviewState: 'CLEAR' | 'NEEDS_REVIEW';
  sourceReviewNote: string | null;
  sourceEvidence: string[];
}
export interface ClaimSummary {
  id: string;
  travelRequest: string;
  status: ClaimStatus;
}
