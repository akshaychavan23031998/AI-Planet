import type { OpenAPIV3 } from 'openapi-types';
import { array, object, ref, canonicalSettlement } from './schemas.js';

const error = (code: string, message: string) => ({ error: { code, message } });
export const responses: Record<string, OpenAPIV3.ResponseObject> = {
  BadRequest: {
    description:
      '400 INVALID_ID, INVALID_REQUEST or INVALID_BODY. Unsupported query/body properties are rejected. JSON bodies have a 64 KB limit.',
    content: {
      'application/json': {
        schema: ref('ApiError'),
        example: error('INVALID_ID', 'Request validation failed.'),
      },
    },
  },
  Unauthorized: {
    description: '401 DEMO_IDENTITY_REQUIRED or IDENTITY_NOT_FOUND.',
    content: {
      'application/json': {
        schema: ref('ApiError'),
        example: error(
          'DEMO_IDENTITY_REQUIRED',
          'X-Demo-Employee-Code is required.',
        ),
      },
    },
  },
  Forbidden: {
    description:
      '403 NOT_CLAIMANT, NOT_REQUIRED_APPROVER, SELF_APPROVAL_FORBIDDEN, FINANCE_ROLE_REQUIRED or ACTION_NOT_ALLOWED. Actor or current state prohibits the action.',
    content: { 'application/json': { schema: ref('ApiError') } },
  },
  NotFound: {
    description:
      '404 CLAIM_NOT_FOUND, TRAVEL_REQUEST_NOT_FOUND, EVIDENCE_NOT_FOUND or EXPENSE_NOT_FOUND. A syntactically valid ID does not identify the required resource.',
    content: { 'application/json': { schema: ref('ApiError') } },
  },
  Conflict: {
    description:
      '409 CLAIM_STATE_CONFLICT or REQUIRED_APPROVER_NOT_FOUND. Reload after a conflicting mutation; the required hierarchy must be resolvable.',
    content: {
      'application/json': {
        schema: ref('ApiError'),
        example: error(
          'CLAIM_STATE_CONFLICT',
          'Claim changed while this action was being processed. Reload before retrying.',
        ),
      },
    },
  },
  UnprocessableEntity: {
    description:
      '422 POLICY_NOT_READY, RETURN_REMARKS_REQUIRED, INVALID_PAYMENT_DATE, PAYMENT_REFERENCE_REQUIRED or INVALID_MANUAL_RESOLUTION. Submit/resubmit policy errors include details.findings.',
    content: {
      'application/json': {
        schema: ref('ApiError'),
        example: error('POLICY_NOT_READY', 'Claim is not ready to submit.'),
      },
    },
  },
  InternalError: {
    description:
      '500 Unexpected failure. No stack or database details are exposed.',
    content: {
      'application/json': {
        schema: ref('ApiError'),
        example: error('INTERNAL_ERROR', 'Internal server error.'),
      },
    },
  },
};
const responseRef = (name: string) => ({
  $ref: `#/components/responses/${name}`,
});
const failureResponses = {
  '400': responseRef('BadRequest'),
  '401': responseRef('Unauthorized'),
  '403': responseRef('Forbidden'),
  '404': responseRef('NotFound'),
  '409': responseRef('Conflict'),
  '500': responseRef('InternalError'),
};
const envelope = (name: string, list = false) =>
  object({
    data: list ? array(ref(name)) : ref(name),
    ...(list
      ? { meta: object({ count: { type: 'integer', minimum: 0 } }) }
      : {}),
  });
const success = (name: string, list = false): OpenAPIV3.ResponseObject => ({
  description: 'Success',
  content: { 'application/json': { schema: envelope(name, list) } },
});
const parameter = (name: string): OpenAPIV3.ParameterObject => ({
  name,
  in: 'path',
  required: true,
  schema: ref('MongoId'),
  description:
    name === 'travelRequestId'
      ? 'Mongo TravelRequest document ID, not the nullable business travelRequestId field.'
      : 'Mongo document ID obtained from API list/detail responses.',
});
const body = (
  schema: string,
  required: boolean,
  example?: Record<string, unknown>,
): OpenAPIV3.RequestBodyObject => ({
  required,
  content: {
    'application/json': {
      schema: ref(schema),
      ...(example ? { example } : {}),
    },
  },
});
function operation(
  operationId: string,
  tag: string,
  summary: string,
  description: string,
  response: string,
  ids: string[] = [],
  list = false,
): OpenAPIV3.OperationObject {
  return {
    operationId,
    tags: [tag],
    summary,
    description: `${description} Unsupported query parameters are rejected.`,
    security: [{ DemoEmployee: [] }],
    ...(ids.length ? { parameters: ids.map(parameter) } : {}),
    responses: { '200': success(response, list), ...failureResponses },
  };
}
function action(
  operationId: string,
  tag: string,
  summary: string,
  description: string,
  request: OpenAPIV3.RequestBodyObject | undefined,
  response = 'WorkflowResult',
  review = false,
): OpenAPIV3.PathItemObject {
  const op = operation(
    operationId,
    tag,
    summary,
    description,
    response,
    review ? ['claimId', 'expenseId'] : ['claimId'],
  );
  return {
    post: {
      ...op,
      ...(request ? { requestBody: request } : {}),
      responses: {
        ...op.responses,
        ...(['excludeExpense', 'restoreExpense'].includes(operationId)
          ? {}
          : { '422': responseRef('UnprocessableEntity') }),
      },
    },
  };
}
const visibility =
  'Visible to the claimant, exact current resolved business approver, or Finance for FINANCE_REVIEW, PAYMENT_SCHEDULED and PAID claims. Unrelated actors cannot read details.';
const review =
  'Claimant only, DRAFT or RETURNED only. Treatment and append-only history are Claim-specific; source Expense and Evidence remain unchanged.';
export const paths: OpenAPIV3.PathsObject = {
  '/health': {
    get: {
      operationId: 'health',
      tags: ['Operations'],
      summary: 'HTTP liveness',
      description: 'Does not inspect or query MongoDB.',
      security: [],
      responses: {
        '200': {
          description: 'HTTP application is alive.',
          content: {
            'application/json': {
              schema: object({ status: { type: 'string', enum: ['ok'] } }),
              example: { status: 'ok' },
            },
          },
        },
      },
    },
  },
  '/ready': {
    get: {
      operationId: 'ready',
      tags: ['Operations'],
      summary: 'Database readiness',
      description:
        'Inspects current connection state without opening a connection or querying MongoDB.',
      security: [],
      responses: {
        '200': {
          description: 'Connected',
          content: {
            'application/json': {
              schema: object({
                status: { type: 'string', enum: ['ready'] },
                database: { type: 'string', enum: ['connected'] },
              }),
              example: { status: 'ready', database: 'connected' },
            },
          },
        },
        '503': {
          description:
            'Disconnected; this operational response does not use the feature error envelope.',
          content: {
            'application/json': {
              schema: object({
                status: { type: 'string', enum: ['not_ready'] },
                database: { type: 'string', enum: ['disconnected'] },
              }),
              example: { status: 'not_ready', database: 'disconnected' },
            },
          },
        },
      },
    },
  },
  '/api/v1/demo/users': {
    get: {
      ...operation(
        'demoUsers',
        'Demo',
        'List demo personas',
        'Public seeded employee summaries for the demo persona switcher, sorted by employee code.',
        'EmployeeSummary',
        [],
        true,
      ),
      security: [],
      responses: {
        '200': success('EmployeeSummary', true),
        '400': responseRef('BadRequest'),
        '500': responseRef('InternalError'),
      },
    },
  },
  '/api/v1/travel-requests': {
    get: operation(
      'travelRequests',
      'Travel Requests',
      'List visible travel requests',
      `${visibility} Actor-scoped list; not a global directory.`,
      'TravelRequest',
      [],
      true,
    ),
  },
  '/api/v1/travel-requests/{travelRequestId}': {
    get: operation(
      'travelRequest',
      'Travel Requests',
      'Read a travel request',
      `${visibility} Historical RM approval does not establish missing HOD approval.`,
      'TravelRequest',
      ['travelRequestId'],
    ),
  },
  '/api/v1/travel-requests/{travelRequestId}/evidence': {
    get: {
      ...operation(
        'travelEvidence',
        'Evidence',
        'List source evidence',
        `${visibility} Includes failed payments, duplicates, claimant mismatches and noise. Metadata and relative references only; no image bytes.`,
        'Evidence',
        ['travelRequestId'],
        true,
      ),
      parameters: [
        parameter('travelRequestId'),
        {
          name: 'kind',
          in: 'query',
          schema: { type: 'string', enum: ['EMAIL', 'IMAGE'] },
          example: 'IMAGE',
        },
        {
          name: 'classification',
          in: 'query',
          schema: ref('EvidenceClassification'),
          example: 'DUPLICATE',
        },
      ],
    },
  },
  '/api/v1/evidence/{evidenceId}': {
    get: operation(
      'evidence',
      'Evidence',
      'Read source evidence',
      `${visibility} Returns metadata, email text and relative references; no raw attachment bytes. Missing evidence returns 404 EVIDENCE_NOT_FOUND.`,
      'Evidence',
      ['evidenceId'],
    ),
  },
  '/api/v1/travel-requests/{travelRequestId}/expenses': {
    get: operation(
      'travelExpenses',
      'Expenses',
      'List normalized source expenses',
      `${visibility} Source amounts are not policy-approved reimbursement. Company-paid costs remain auditable.`,
      'Expense',
      ['travelRequestId'],
      true,
    ),
  },
  '/api/v1/claims': {
    get: operation(
      'claims',
      'Claims',
      'List visible claims',
      `${visibility} Empty list when no claim is visible.`,
      'Claim',
      [],
      true,
    ),
  },
  '/api/v1/claims/{claimId}': {
    get: operation(
      'claim',
      'Claims',
      'Read claim and review history',
      visibility,
      'Claim',
      ['claimId'],
    ),
  },
  '/api/v1/claims/{claimId}/validation': {
    get: operation(
      'claimValidation',
      'Claims',
      'Evaluate policy findings and expenses',
      `${visibility} Includes per-expense results and required approval levels; this differs from readiness. No outcomes are persisted.`,
      'Validation',
      ['claimId'],
    ),
  },
  '/api/v1/claims/{claimId}/readiness': {
    get: operation(
      'claimReadiness',
      'Claims',
      'Evaluate submission readiness',
      `${visibility} Included unresolved expenses block submission. Historical exceptions remain visible without fabricated source data.`,
      'Readiness',
      ['claimId'],
    ),
  },
  '/api/v1/claims/{claimId}/settlement': {
    get: {
      ...operation(
        'claimSettlement',
        'Claims',
        'Evaluate provisional or final settlement',
        `${visibility} Raw gross is not reimbursement; this calculation does not authorize payment.`,
        'Settlement',
        ['claimId'],
      ),
      responses: {
        ...failureResponses,
        '200': {
          ...success('Settlement'),
          content: {
            'application/json': {
              schema: envelope('Settlement'),
              example: { data: canonicalSettlement },
            },
          },
        },
      },
    },
  },
  '/api/v1/claims/{claimId}/expenses/{expenseId}/exclude': action(
    'excludeExpense',
    'Claims',
    'Exclude expense from this claim',
    review,
    body('ExcludeExpenseRequest', true, {
      reason: 'Missing required supporting details',
    }),
    'Claim',
    true,
  ),
  '/api/v1/claims/{claimId}/expenses/{expenseId}/restore': action(
    'restoreExpense',
    'Claims',
    'Restore expense inclusion',
    `${review} Retains any explicit tax allocation and prior history. No body is required; an empty JSON object is accepted and extra properties are rejected.`,
    undefined,
    'Claim',
    true,
  ),
  '/api/v1/claims/{claimId}/expenses/{expenseId}/resolve': action(
    'resolveExpense',
    'Claims',
    'Record explicit mixed hotel tax allocation',
    `${review} Mixed hotel tax only. Integer non-negative allocations must total the source amount. Resolving an excluded expense does not restore inclusion. The request example is hypothetical, not canonical treatment. Schema/allocation errors return 422 INVALID_MANUAL_RESOLUTION.`,
    body('ResolveExpenseRequest', true, {
      reimbursableMinor: 100000,
      disallowedMinor: 130400,
      reason: 'Hypothetical allocation after supporting review',
    }),
    'Claim',
    true,
  ),
  '/api/v1/claims/{claimId}/submit': action(
    'submitClaim',
    'Claims',
    'Submit a draft claim',
    'Claimant only, DRAFT only. Evaluates policy and enters the backend-selected first required business-review state. The unresolved canonical scenario returns 422 POLICY_NOT_READY with details.findings. No body is required; an empty object is accepted. Status, role, cycle and approver inputs are rejected.',
    undefined,
  ),
  '/api/v1/claims/{claimId}/resubmit': action(
    'resubmitClaim',
    'Claims',
    'Resubmit a returned claim',
    'Claimant only, RETURNED only. Re-evaluates policy, recalculates the route and restarts the complete required route in a new review cycle, retaining prior audit history. No body is required; an empty object is accepted; extra properties are rejected.',
    undefined,
  ),
  '/api/v1/approvals': {
    get: operation(
      'approvals',
      'Approvals',
      'List current business assignments',
      'Returns only Claims currently assigned to the exact resolved business approver; not all managerial claims.',
      'Claim',
      [],
      true,
    ),
  },
  '/api/v1/claims/{claimId}/approve': action(
    'approveClaim',
    'Approvals',
    'Approve current business review',
    'Exact current resolved business approver only; self-approval prohibited. Backend selects the next required review or Finance stage.',
    body('ApproveClaimRequest', false, { remarks: 'Reviewed and approved' }),
  ),
  '/api/v1/claims/{claimId}/return': action(
    'returnClaim',
    'Approvals',
    'Return claim for correction',
    'Exact current business approver only; self-review prohibited. Nonblank remarks are mandatory. Missing/blank remarks return 422 RETURN_REMARKS_REQUIRED, while malformed body returns 400.',
    body('ReturnClaimRequest', true, {
      remarks: 'Please provide additional supporting details.',
    }),
  ),
  '/api/v1/finance/claims': {
    get: operation(
      'financeClaims',
      'Finance',
      'List Finance claims',
      'Finance role only. Includes FINANCE_REVIEW, PAYMENT_SCHEDULED and PAID. This list is not a global claim directory.',
      'Claim',
      [],
      true,
    ),
  },
  '/api/v1/claims/{claimId}/finance/verify': action(
    'verifyFinance',
    'Finance',
    'Verify final settlement',
    'Finance role only, no self-review, FINANCE_REVIEW only, after required business approvals. Does not mark paid. Recoverable and zero settlements remain verified in FINANCE_REVIEW.',
    body('ApproveClaimRequest', false, {
      remarks: 'Verified supporting records',
    }),
  ),
  '/api/v1/claims/{claimId}/finance/schedule-payment': action(
    'schedulePayment',
    'Finance',
    'Schedule a payable settlement',
    'Finance role only, no self-review; requires Finance verification and a payable settlement. Domain permits a non-past 10th or 25th using India business dates. Choose a valid future date; the example is hypothetical. Malformed dates return 400; valid dates violating scheduling rules return 422 INVALID_PAYMENT_DATE.',
    body('SchedulePaymentRequest', true, { scheduledFor: '2099-07-10' }),
  ),
  '/api/v1/claims/{claimId}/finance/mark-paid': action(
    'markPaid',
    'Finance',
    'Record demo payment confirmation',
    'Finance role only, no self-review; requires PAYMENT_SCHEDULED and an arrived scheduled date. Nonblank payment reference is required. Missing/blank reference returns 422 PAYMENT_REFERENCE_REQUIRED. Hypothetical demo confirmation only; no payment-provider execution.',
    body('MarkPaidRequest', true, { paymentReference: 'DEMO-PAY-001' }),
  ),
};
