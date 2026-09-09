import type { ApprovalLevel } from '../policy/types.js';
import type { evaluateClaimPolicy } from '../policy/evaluateClaim.js';

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
export const workflowActions = [
  'SUBMITTED',
  'APPROVED',
  'RETURNED',
  'RESUBMITTED',
  'FINANCE_VERIFIED',
  'PAYMENT_SCHEDULED',
  'PAID',
] as const;
export type WorkflowAction = (typeof workflowActions)[number];
export const businessLevels = [
  'REPORTING_MANAGER',
  'HEAD_OF_DEPARTMENT',
  'HEAD_OF_DIVISION',
  'MANAGING_DIRECTOR',
] as const satisfies readonly ApprovalLevel[];
export interface Actor {
  employeeId: string;
  employeeCode: string;
  name: string;
  organizationalRole: ApprovalLevel | 'EMPLOYEE' | 'FINANCE';
  reportingManagerId: string | null;
}
export interface ResolvedApprover {
  level: ApprovalLevel;
  employeeId: string;
}
export interface ClaimApproval {
  level: ApprovalLevel;
  approver: string;
  decision: 'APPROVED' | 'RETURNED';
  decidedAt: Date;
  remarks?: string;
  reviewCycle: number;
}
export interface WorkflowEvent {
  action: WorkflowAction;
  fromStatus: ClaimStatus;
  toStatus: ClaimStatus;
  actor: string;
  actorRole: Actor['organizationalRole'];
  occurredAt: Date;
  remarks?: string;
  reviewCycle: number;
}
export interface FinanceMetadata {
  verifiedBy: string;
  verifiedAt: Date;
  reviewCycle: number;
  paymentScheduledFor?: string;
  paymentScheduledBy?: string;
  paidAt?: Date;
  paymentReference?: string;
}
export interface WorkflowClaim {
  claimId: string;
  employeeId: string;
  status: ClaimStatus;
  reviewCycle: number;
  workflowVersion: number;
  approvals: readonly ClaimApproval[];
  workflowHistory: readonly WorkflowEvent[];
  reviewRoute: readonly ResolvedApprover[];
  reviewInputHash: string | null;
  finance: FinanceMetadata | null;
}
export interface WorkflowContext {
  claim: WorkflowClaim;
  claimant: Actor;
  hierarchy: readonly Actor[];
  policy: ReturnType<typeof evaluateClaimPolicy>;
  policyInputHash: string;
}
export type WorkflowCommand =
  | { action: 'SUBMITTED' }
  | { action: 'RESUBMITTED' }
  | { action: 'APPROVED'; remarks?: string }
  | { action: 'FINANCE_VERIFIED'; remarks?: string }
  | { action: 'RETURNED'; remarks: string }
  | { action: 'PAYMENT_SCHEDULED'; scheduledFor: string }
  | { action: 'PAID'; paymentReference: string };
export interface WorkflowPlan {
  status: ClaimStatus;
  reviewCycle: number;
  reviewRoute: readonly ResolvedApprover[];
  reviewInputHash: string | null;
  finance: FinanceMetadata | null;
  approval?: ClaimApproval;
  event: WorkflowEvent;
}
