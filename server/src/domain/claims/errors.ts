export type WorkflowErrorCode =
  | 'TRAVEL_REQUEST_NOT_FOUND'
  | 'EVIDENCE_NOT_FOUND'
  | 'EXPENSE_NOT_FOUND'
  | 'INVALID_MANUAL_RESOLUTION'
  | 'CLAIM_NOT_FOUND'
  | 'IDENTITY_NOT_FOUND'
  | 'CLAIM_STATE_CONFLICT'
  | 'ACTION_NOT_ALLOWED'
  | 'NOT_CLAIMANT'
  | 'NOT_REQUIRED_APPROVER'
  | 'SELF_APPROVAL_FORBIDDEN'
  | 'POLICY_NOT_READY'
  | 'REQUIRED_APPROVER_NOT_FOUND'
  | 'FINANCE_ROLE_REQUIRED'
  | 'RETURN_REMARKS_REQUIRED'
  | 'INVALID_PAYMENT_DATE'
  | 'PAYMENT_REFERENCE_REQUIRED';

export class WorkflowError extends Error {
  constructor(
    public readonly code: WorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}
export function requireWorkflow(
  condition: unknown,
  code: WorkflowErrorCode,
  message: string,
): asserts condition {
  if (!condition) throw new WorkflowError(code, message);
}
