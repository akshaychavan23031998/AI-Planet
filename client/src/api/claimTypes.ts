import type { DemoEmployee } from './demo';
export const claimStatuses = [
  'DRAFT',
  'MANAGER_REVIEW',
  'HOD_REVIEW',
  'DIVISION_REVIEW',
  'MD_REVIEW',
  'FINANCE_REVIEW',
  'RETURNED',
  'PAYMENT_SCHEDULED',
  'PAID',
] as const;
export type ClaimStatus = (typeof claimStatuses)[number];
export interface ManualResolution {
  reimbursableMinor: number;
  disallowedMinor: number;
  reason: string;
}
export interface WorkflowEvent {
  action:
    | 'SUBMITTED'
    | 'APPROVED'
    | 'RETURNED'
    | 'RESUBMITTED'
    | 'FINANCE_VERIFIED'
    | 'PAYMENT_SCHEDULED'
    | 'PAID';
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
  actor: string;
  actorRole: string;
  occurredAt: string | null;
  remarks: string | null;
  reviewCycle: number;
}
export interface Claim {
  id: string;
  travelRequest: string;
  employee: DemoEmployee;
  currency: 'INR';
  status: ClaimStatus;
  reviewCycle: number;
  expenseCount: number;
  finance: null | {
    verifiedBy: string | null;
    verifiedAt: string | null;
    reviewCycle: number;
    paymentScheduledFor: string | null;
    paymentScheduledBy: string | null;
    paidAt: string | null;
    paymentReference: string | null;
  };
  approvals: {
    level: string;
    approver: string;
    decision: 'APPROVED' | 'RETURNED';
    decidedAt: string | null;
    remarks: string | null;
    reviewCycle: number;
  }[];
  workflowHistory: WorkflowEvent[];
  reviewRoute: { level: string; employeeId: string }[];
  expenseReviews: {
    expense: string;
    included: boolean;
    exclusionReason: string | null;
    manualResolution: ManualResolution | null;
    updatedBy: string;
    updatedAt: string | null;
  }[];
  expenseReviewHistory: {
    action: 'EXCLUDED' | 'RESTORED' | 'RESOLVED';
    expense: string;
    actor: string;
    occurredAt: string | null;
    reason: string | null;
    resolution: ManualResolution | null;
  }[];
}
export interface PolicyFinding {
  code: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
  policyReference: string;
  blocking: boolean;
  userActionRequired: boolean;
  historicalException: boolean;
  expenseKey?: string;
  evidenceKeys?: string[];
}
export interface ExpenseEvaluation {
  expenseKey: string;
  sourceAmountMinor: number;
  knownEligibleMinor: number;
  knownDisallowedMinor: number;
  unresolvedMinor: number;
  excludedMinor: number;
  findings: PolicyFinding[];
  status:
    | 'ELIGIBLE'
    | 'PARTIALLY_DISALLOWED'
    | 'DISALLOWED'
    | 'UNRESOLVED'
    | 'COMPANY_PAID'
    | 'EXCLUDED'
    | 'DUPLICATE'
    | 'NOT_PAID';
}
export interface ClaimValidation {
  findings: PolicyFinding[];
  expenseResults: ExpenseEvaluation[];
  requiredClaimApprovalLevels: string[];
  claimedValueMinor: number;
  claimApprovalBasisIsProvisional: boolean;
}
export interface ClaimReadiness {
  isReadyToSubmit: boolean;
  blockingIssues: PolicyFinding[];
  warnings: PolicyFinding[];
  informational: PolicyFinding[];
}
export interface ClaimSettlement {
  employeePaidGrossMinor: number;
  companyPaidGrossMinor: number;
  knownEligibleMinor: number;
  knownDisallowedMinor: number;
  unresolvedMinor: number;
  excludedMinor: number;
  advanceMinor: number;
  payableMinor: number | null;
  recoverableMinor: number | null;
  isFinal: boolean;
}
export interface WorkflowResult {
  claimId: string;
  currentStatus: ClaimStatus;
  reviewCycle: number;
  workflowEvent: WorkflowEvent;
}
