import type { OpenAPIV3 } from 'openapi-types';
import {
  businessLevels,
  claimStatuses,
  workflowActions,
} from '../domain/claims/types.js';

export type Schema = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
export const ref = (name: string): Schema => ({
  allOf: [{ $ref: `#/components/schemas/${name}` }],
});
export const array = (items: Schema): Schema => ({ type: 'array', items });
// OpenAPI 3.0 needs an explicit null-only branch when the other branch is a reference.
export const nullable = (schema: Schema): Schema => ({
  anyOf: [schema, { type: 'object', nullable: true, enum: [null] }],
});
export const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): OpenAPIV3.SchemaObject => ({
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required.length ? { required } : {}),
});
const text: Schema = { type: 'string' };
const bool: Schema = { type: 'boolean' };
const integer: Schema = {
  type: 'integer',
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};
const enumeration = (values: readonly string[]): Schema => ({
  type: 'string',
  enum: [...values],
});
const id = ref('MongoId');
const money = ref('MoneyMinor');
const date = ref('BusinessDate');
const timestamp = ref('Timestamp');
const role = ref('OrganizationalRole');
const level = ref('ApprovalLevel');
const status = { ...ref('ClaimStatus'), readOnly: true };
const action = ref('WorkflowAction');
const reason: Schema = {
  type: 'string',
  minLength: 1,
  maxLength: 2000,
  description: 'Trimmed; must contain non-whitespace text.',
};
const remarks: Schema = {
  type: 'string',
  maxLength: 2000,
  description: 'Trimmed by the server.',
};
export const evidenceClassifications = [
  'SUPPORTING_TRIP',
  'APPROVAL',
  'ADVANCE',
  'COMPANY_PAID_COST',
  'EMPLOYEE_PAID_CANDIDATE',
  'PAYMENT_FAILURE',
  'DUPLICATE',
  'NEEDS_REVIEW',
  'CLAIMANT_MISMATCH',
  'NOISE',
  'SUPPORTING_DOCUMENT',
];
export const canonicalSettlement = {
  employeePaidGrossMinor: 2731804,
  companyPaidGrossMinor: 1055600,
  knownEligibleMinor: 2192904,
  knownDisallowedMinor: 83000,
  unresolvedMinor: 455900,
  excludedMinor: 0,
  advanceMinor: 2000000,
  payableMinor: null,
  recoverableMinor: null,
  isFinal: false,
};
export const schemas: Record<string, OpenAPIV3.SchemaObject> = {
  MongoId: {
    type: 'string',
    pattern: '^[0-9a-fA-F]{24}$',
    description:
      'Mongo document identifier. Obtain IDs from list responses; this is not a business Travel Request ID.',
  },
  MoneyMinor: {
    ...integer,
    description: 'Integer minor units. For INR, 100 minor units = INR 1.00.',
    example: 141502,
  },
  BusinessDate: {
    type: 'string',
    format: 'date',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    description: 'Date only, without timezone conversion.',
    example: '2026-06-18',
  },
  Timestamp: {
    type: 'string',
    format: 'date-time',
    description: 'An actual timestamp serialized as ISO 8601 UTC.',
  },
  Currency: { type: 'string', enum: ['INR'] },
  OrganizationalRole: {
    type: 'string',
    enum: ['EMPLOYEE', ...businessLevels, 'FINANCE'],
  },
  ApprovalLevel: { type: 'string', enum: [...businessLevels] },
  ClaimStatus: {
    type: 'string',
    enum: [...claimStatuses],
    description: 'SUBMITTED is an audit action, not a persisted status.',
  },
  WorkflowAction: { type: 'string', enum: [...workflowActions] },
  EvidenceClassification: {
    type: 'string',
    enum: evidenceClassifications,
    description: 'Source classification, not final policy eligibility.',
  },
  EmployeeSummary: object({
    id: { ...id, readOnly: true },
    employeeCode: { type: 'string', example: 'NX-4471' },
    name: { type: 'string', example: 'Chaitanya Reddy' },
    organizationalRole: role,
  }),
  TravelRequest: object({
    id: { ...id, readOnly: true },
    travelRequestId: {
      ...nullable(text),
      description:
        'Actual business identifier. Missing in the canonical scenario; never substitute a seed key or workbook example.',
      example: null,
    },
    employee: ref('EmployeeSummary'),
    origin: { type: 'string', example: 'Pune' },
    destination: { type: 'string', example: 'Bengaluru' },
    startDate: { ...date, example: '2026-06-16' },
    endDate: { ...date, example: '2026-06-20' },
    purpose: text,
    travelType: enumeration(['DOMESTIC', 'INTERNATIONAL']),
    costCentre: text,
    currency: ref('Currency'),
    estimatedSpendMinor: { ...money, example: 4800000 },
    advanceRequestedMinor: { ...money, example: 2000000 },
    advanceDisbursedMinor: { ...money, example: 2000000 },
    advanceReference: nullable(text),
    advanceDisbursedDate: nullable(date),
    advanceNotifiedAt: nullable(timestamp),
    plannedLodgingNights: integer,
    evidencedLodgingNights: nullable(integer),
    preTravelApprovals: array(
      object({
        approver: id,
        role,
        decision: enumeration(['APPROVED']),
        approvedAt: nullable(timestamp),
        evidence: id,
      }),
    ),
    sourceNotes: array(text),
  }),
  EmailAddress: object({ name: nullable(text), address: text }),
  ReceiptMetadata: object({
    method: enumeration(['CANONICAL_DOCUMENT']),
    canonicalReference: nullable(text),
    merchant: text,
    documentNumber: text,
    gstin: nullable(text),
    currency: ref('Currency'),
    totalMinor: money,
    subtotalMinor: money,
    receiptDate: nullable(date),
    occurredAt: nullable(timestamp),
    covers: nullable(integer),
    attendeeOrganization: nullable(text),
    guestName: nullable(text),
    checkInAt: nullable(timestamp),
    checkOutAt: nullable(timestamp),
    nights: nullable(integer),
    room: nullable(text),
    balanceDueMinor: nullable(money),
    lines: array(
      object({
        description: text,
        amountMinor: money,
        date: nullable(date),
        quantity: nullable(integer),
      }),
    ),
  }),
  Evidence: object({
    id,
    travelRequest: id,
    kind: enumeration(['EMAIL', 'IMAGE']),
    classification: ref('EvidenceClassification'),
    sourceFilename: text,
    sourceRelativePath: {
      ...nullable(text),
      description: 'Relative source reference only; no local absolute paths.',
    },
    mimeType: text,
    messageId: nullable(text),
    subject: nullable(text),
    sender: nullable(ref('EmailAddress')),
    to: array(nullable(ref('EmailAddress'))),
    cc: array(nullable(ref('EmailAddress'))),
    receivedAt: nullable(timestamp),
    bodyText: nullable(text),
    contentHashSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    parentEvidence: nullable(id),
    relationships: array(
      object({
        type: enumeration([
          'HAS_REPLY',
          'RESOLVED_BY',
          'DUPLICATE_OF',
          'HAS_ATTACHMENT',
          'FINALIZED_BY',
        ]),
        evidence: id,
      }),
    ),
    attachments: array(
      object({
        filename: text,
        mimeType: text,
        sourceRelativePath: nullable(text),
        representation: enumeration(['EXTERNAL_PACK_POINTER']),
      }),
    ),
    assetReference: {
      ...nullable(text),
      description:
        'Relative asset reference; this API does not serve image bytes.',
    },
    metadata: nullable(ref('ReceiptMetadata')),
  }),
  Expense: object({
    id,
    travelRequest: id,
    employee: id,
    category: enumeration([
      'AIR_TRAVEL',
      'LODGING',
      'LOCAL_CONVEYANCE',
      'MEAL',
      'BUSINESS_ENTERTAINMENT',
      'OTHER',
    ]),
    componentType: enumeration([
      'FLIGHT_SECTOR',
      'RIDE',
      'DINNER',
      'ROOM',
      'LAUNDRY',
      'MINIBAR',
      'IN_ROOM_DINING',
      'HOTEL_MIXED_TAX',
    ]),
    expenseDate: nullable(date),
    occurredAt: nullable(timestamp),
    merchant: text,
    description: text,
    amountMinor: {
      ...money,
      description: 'Normalized source amount, not approved reimbursement.',
    },
    currency: ref('Currency'),
    paidBy: {
      ...enumeration(['EMPLOYEE', 'COMPANY']),
      description:
        'Company-paid costs remain auditable but do not contribute to employee reimbursement.',
    },
    sourceReviewState: enumeration(['CLEAR', 'NEEDS_REVIEW']),
    sourceReviewNote: nullable(text),
    sourceEvidence: array(id),
    details: nullable(
      object({
        origin: nullable(text),
        destination: nullable(text),
        flightNumber: nullable(text),
        pnr: nullable(text),
        bookingReference: nullable(text),
        invoiceNumber: nullable(text),
        paymentMethod: nullable(text),
        covers: nullable(integer),
        attendeeOrganization: nullable(text),
        baseFareMinor: nullable(money),
        taxesAndFeesMinor: nullable(money),
        airportSurchargeMinor: nullable(money),
      }),
    ),
  }),
  Approval: object({
    level,
    approver: id,
    decision: enumeration(['APPROVED', 'RETURNED']),
    decidedAt: nullable(timestamp),
    remarks: nullable(text),
    reviewCycle: integer,
  }),
  WorkflowHistory: object({
    action,
    fromStatus: status,
    toStatus: status,
    actor: id,
    actorRole: role,
    occurredAt: nullable(timestamp),
    remarks: nullable(text),
    reviewCycle: integer,
  }),
  Finance: object({
    verifiedBy: nullable(id),
    verifiedAt: nullable(timestamp),
    reviewCycle: integer,
    paymentScheduledFor: nullable(date),
    paymentScheduledBy: nullable(id),
    paidAt: nullable(timestamp),
    paymentReference: nullable(text),
  }),
  ManualResolution: {
    ...object({
      reimbursableMinor: money,
      disallowedMinor: money,
      reason: text,
    }),
    description:
      'Explicit Claim-specific mixed hotel tax allocation. The two integer allocations must total the source amount; a nonblank reason is required. No canonical allocation is assumed.',
  },
  ExpenseReview: {
    ...object({
      expense: id,
      included: bool,
      exclusionReason: nullable(text),
      manualResolution: nullable(ref('ManualResolution')),
      updatedBy: id,
      updatedAt: nullable(timestamp),
    }),
    description:
      'Claim-specific treatment; source Expense and Evidence remain unchanged.',
  },
  ExpenseReviewHistory: object({
    action: enumeration(['EXCLUDED', 'RESTORED', 'RESOLVED']),
    expense: id,
    actor: id,
    occurredAt: nullable(timestamp),
    reason: nullable(text),
    resolution: nullable(ref('ManualResolution')),
  }),
  Claim: object({
    id: { ...id, readOnly: true },
    employee: ref('EmployeeSummary'),
    travelRequest: id,
    currency: ref('Currency'),
    status,
    reviewCycle: { ...integer, readOnly: true },
    workflowVersion: {
      ...integer,
      readOnly: true,
      description: 'Response-only revision; not accepted in mutation bodies.',
    },
    expenseCount: integer,
    approvals: { ...array(ref('Approval')), readOnly: true },
    workflowHistory: { ...array(ref('WorkflowHistory')), readOnly: true },
    finance: nullable(ref('Finance')),
    reviewRoute: array(object({ level, employeeId: id })),
    expenseReviews: array(ref('ExpenseReview')),
    expenseReviewHistory: array(ref('ExpenseReviewHistory')),
  }),
  PolicyFinding: object(
    {
      code: {
        type: 'string',
        description: 'Stable policy finding code.',
        enum: [
          'MISSING_TRAVEL_REQUEST_ID',
          'MISSING_PRETRAVEL_HOD_APPROVAL',
          'MISSING_PRETRAVEL_APPROVAL',
          'ADVANCE_CAP_UNDETERMINED',
          'ADVANCE_CAP_EXCEEDED',
          'MISSING_PROOF',
          'CLAIMANT_MISMATCH',
          'DUPLICATE_EXPENSE',
          'FAILED_PAYMENT_EVIDENCE',
          'LODGING_OVER_LIMIT',
          'NON_REIMBURSABLE_LAUNDRY',
          'NON_REIMBURSABLE_MINIBAR',
          'HOTEL_TAX_ALLOCATION_UNRESOLVED',
          'HOTEL_TAX_ALLOCATION_RECORDED',
          'MEAL_DAILY_LIMIT_EXCEEDED',
          'MEAL_DATE_OR_TIER_UNRESOLVED',
          'BUSINESS_ENTERTAINMENT_ATTENDEE_NAMES_MISSING',
          'BUSINESS_ENTERTAINMENT_ORGANISATIONS_MISSING',
          'BUSINESS_ENTERTAINMENT_HOD_APPROVAL_MISSING',
          'POLICY_REVIEW_REQUIRED',
          'EXCLUDED_EXPENSE',
          'COMPANY_PAID_COST',
          'AIR_TRAVEL_NOT_EMPLOYEE_CLAIM',
          'EMPTY_CLAIM',
        ],
      },
      severity: enumeration(['BLOCKING', 'WARNING', 'INFO']),
      message: text,
      policyReference: text,
      blocking: bool,
      userActionRequired: bool,
      historicalException: bool,
      expenseKey: text,
      evidenceKeys: array(text),
      metadata: {
        type: 'object',
        additionalProperties: {
          anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        },
      },
    },
    [
      'code',
      'severity',
      'message',
      'policyReference',
      'blocking',
      'userActionRequired',
      'historicalException',
    ],
  ),
  ExpenseEvaluation: object({
    expenseKey: text,
    sourceAmountMinor: money,
    employeePaidCandidateMinor: money,
    companyPaidMemoMinor: money,
    excludedMinor: money,
    knownEligibleMinor: money,
    knownDisallowedMinor: money,
    unresolvedMinor: money,
    findings: array(ref('PolicyFinding')),
    status: enumeration([
      'ELIGIBLE',
      'PARTIALLY_DISALLOWED',
      'DISALLOWED',
      'UNRESOLVED',
      'COMPANY_PAID',
      'EXCLUDED',
      'DUPLICATE',
      'NOT_PAID',
    ]),
  }),
  Validation: object({
    findings: array(ref('PolicyFinding')),
    expenseResults: array(ref('ExpenseEvaluation')),
    requiredClaimApprovalLevels: array(level),
    claimedValueMinor: money,
    claimApprovalBasisIsProvisional: bool,
  }),
  Readiness: object({
    isReadyToSubmit: bool,
    blockingIssues: array(ref('PolicyFinding')),
    warnings: array(ref('PolicyFinding')),
    informational: array(ref('PolicyFinding')),
  }),
  Settlement: {
    ...object({
      employeePaidGrossMinor: money,
      companyPaidGrossMinor: money,
      knownEligibleMinor: money,
      knownDisallowedMinor: money,
      unresolvedMinor: money,
      excludedMinor: money,
      advanceMinor: money,
      payableMinor: nullable(money),
      recoverableMinor: nullable(money),
      isFinal: bool,
    }),
    description:
      'Policy evaluation, not payment authorization. Payable/recoverable are null while provisional; zero is not used for unknown.',
    example: canonicalSettlement,
  },
  WorkflowResult: object({
    claimId: id,
    action,
    previousStatus: status,
    currentStatus: status,
    reviewCycle: integer,
    actor: ref('EmployeeSummary'),
    workflowEvent: ref('WorkflowHistory'),
    settlementDirection: nullable(
      enumeration(['PAYABLE', 'RECOVERABLE', 'ZERO']),
    ),
  }),
  ApiError: object({
    error: object(
      {
        code: text,
        message: text,
        details: {
          type: 'object',
          description: 'Optional validation fields or policy findings.',
          properties: {
            fields: array(text),
            findings: array(ref('PolicyFinding')),
          },
          additionalProperties: true,
        },
      },
      ['code', 'message'],
    ),
  }),

  ExcludeExpenseRequest: object({ reason }),
  ResolveExpenseRequest: {
    ...object({ reimbursableMinor: money, disallowedMinor: money, reason }),
    description:
      'Mixed hotel tax only; allocations must total the source amount. Numbers in examples are hypothetical.',
  },
  ApproveClaimRequest: object({ remarks }, []),
  ReturnClaimRequest: {
    ...object({ remarks: { ...remarks, minLength: 1 } }),
    description:
      'Nonblank trimmed remarks are required by the domain. Omitted/blank remarks return 422 RETURN_REMARKS_REQUIRED; invalid types/extra properties return 400.',
  },
  SchedulePaymentRequest: object({ scheduledFor: date }),
  MarkPaidRequest: {
    ...object({
      paymentReference: { type: 'string', minLength: 1, maxLength: 200 },
    }),
    description:
      'Trimmed nonblank reference required by the domain. Missing/blank returns 422 PAYMENT_REFERENCE_REQUIRED. This is demo confirmation, not external payment execution.',
  },
};
