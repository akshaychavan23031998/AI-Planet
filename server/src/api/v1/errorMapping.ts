import { WorkflowError } from '../../domain/claims/errors.js';
import type { WorkflowErrorCode } from '../../domain/claims/errors.js';

export type ApiErrorCode =
  | WorkflowErrorCode
  | 'INVALID_ID'
  | 'INVALID_REQUEST'
  | 'INVALID_BODY'
  | 'DEMO_IDENTITY_REQUIRED'
  | 'NOT_FOUND';
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
const statuses: Record<ApiErrorCode, number> = {
  INVALID_ID: 400,
  INVALID_REQUEST: 400,
  INVALID_BODY: 400,
  DEMO_IDENTITY_REQUIRED: 401,
  IDENTITY_NOT_FOUND: 401,
  NOT_CLAIMANT: 403,
  NOT_REQUIRED_APPROVER: 403,
  SELF_APPROVAL_FORBIDDEN: 403,
  FINANCE_ROLE_REQUIRED: 403,
  ACTION_NOT_ALLOWED: 403,
  CLAIM_NOT_FOUND: 404,
  TRAVEL_REQUEST_NOT_FOUND: 404,
  EVIDENCE_NOT_FOUND: 404,
  EXPENSE_NOT_FOUND: 404,
  NOT_FOUND: 404,
  CLAIM_STATE_CONFLICT: 409,
  REQUIRED_APPROVER_NOT_FOUND: 409,
  POLICY_NOT_READY: 422,
  RETURN_REMARKS_REQUIRED: 422,
  INVALID_PAYMENT_DATE: 422,
  PAYMENT_REFERENCE_REQUIRED: 422,
  INVALID_MANUAL_RESOLUTION: 422,
};
export function mapApiError(error: unknown) {
  if (error instanceof ApiError || error instanceof WorkflowError)
    return {
      status: statuses[error.code],
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof ApiError && error.details !== undefined
            ? { details: error.details }
            : {}),
        },
      },
    };
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    [
      'entity.parse.failed',
      'entity.too.large',
      'encoding.unsupported',
    ].includes(String(error.type))
  ) {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_BODY',
          message:
            'A valid JSON request body within the size limit is required.',
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error.' },
    },
  };
}
