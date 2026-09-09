export type ApprovalLevel =
  | 'REPORTING_MANAGER'
  | 'HEAD_OF_DEPARTMENT'
  | 'HEAD_OF_DIVISION'
  | 'MANAGING_DIRECTOR';
export type TravelType = 'DOMESTIC' | 'INTERNATIONAL';
export type CityTier = 1 | 2 | 3;
export type FindingCode =
  | 'MISSING_TRAVEL_REQUEST_ID'
  | 'MISSING_PRETRAVEL_HOD_APPROVAL'
  | 'MISSING_PRETRAVEL_APPROVAL'
  | 'ADVANCE_CAP_UNDETERMINED'
  | 'ADVANCE_CAP_EXCEEDED'
  | 'MISSING_PROOF'
  | 'CLAIMANT_MISMATCH'
  | 'DUPLICATE_EXPENSE'
  | 'FAILED_PAYMENT_EVIDENCE'
  | 'LODGING_OVER_LIMIT'
  | 'NON_REIMBURSABLE_LAUNDRY'
  | 'NON_REIMBURSABLE_MINIBAR'
  | 'HOTEL_TAX_ALLOCATION_UNRESOLVED'
  | 'HOTEL_TAX_ALLOCATION_RECORDED'
  | 'MEAL_DAILY_LIMIT_EXCEEDED'
  | 'MEAL_DATE_OR_TIER_UNRESOLVED'
  | 'BUSINESS_ENTERTAINMENT_ATTENDEE_NAMES_MISSING'
  | 'BUSINESS_ENTERTAINMENT_ORGANISATIONS_MISSING'
  | 'BUSINESS_ENTERTAINMENT_HOD_APPROVAL_MISSING'
  | 'POLICY_REVIEW_REQUIRED'
  | 'EXCLUDED_EXPENSE'
  | 'COMPANY_PAID_COST'
  | 'AIR_TRAVEL_NOT_EMPLOYEE_CLAIM'
  | 'EMPTY_CLAIM';
export interface PolicyFinding {
  code: FindingCode;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
  policyReference: string;
  blocking: boolean;
  userActionRequired: boolean;
  historicalException: boolean;
  expenseKey?: string;
  evidenceKeys?: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean>>;
}
export interface PolicyEvidence {
  key: string;
  classification:
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
  relationships?: readonly {
    type:
      | 'HAS_REPLY'
      | 'RESOLVED_BY'
      | 'DUPLICATE_OF'
      | 'HAS_ATTACHMENT'
      | 'FINALIZED_BY';
    evidenceKey: string;
  }[];
}
export interface PolicyApproval {
  level: ApprovalLevel;
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED';
  approvedAt: string;
  evidenceKey: string;
}
export interface HotelTaxResolution {
  reimbursableMinor: number;
  disallowedMinor: number;
  note: string;
}
export interface PolicyExpense {
  key: string;
  employeeKey: string;
  category:
    | 'AIR_TRAVEL'
    | 'LODGING'
    | 'LOCAL_CONVEYANCE'
    | 'MEAL'
    | 'BUSINESS_ENTERTAINMENT'
    | 'OTHER';
  componentType:
    | 'FLIGHT_SECTOR'
    | 'RIDE'
    | 'DINNER'
    | 'ROOM'
    | 'LAUNDRY'
    | 'MINIBAR'
    | 'IN_ROOM_DINING'
    | 'HOTEL_MIXED_TAX';
  amountMinor: number;
  currency: 'INR';
  paidBy: 'EMPLOYEE' | 'COMPANY';
  expenseDate: string | null;
  occurredAt?: string;
  merchant: string;
  billReference?: string;
  lineReference?: string;
  evidenceKeys: readonly string[];
  city?: string;
  cityTier?: CityTier;
  sourceReviewState?: 'CLEAR' | 'NEEDS_REVIEW';
  included?: boolean;
  covers?: number;
  attendeeOrganisation?: string;
  attendees?: readonly { name: string; organisation: string }[];
  entertainmentApproval?: PolicyApproval;
  hotelTaxResolution?: HotelTaxResolution;
}
export interface PolicyInput {
  claimantKey: string;
  travel: {
    travelRequestId: string | null;
    destination: string;
    cityTier?: CityTier;
    startDate: string;
    endDate: string;
    bookingDate?: string;
    travelType: TravelType;
    estimatedSpendMinor: number;
    estimatedEmployeeBorneMinor?: number | null;
    advanceMinor: number;
    preTravelApprovals: readonly PolicyApproval[];
  };
  evidence: readonly PolicyEvidence[];
  expenses: readonly PolicyExpense[];
}
export interface AmountEvaluation {
  knownEligibleMinor: number;
  knownDisallowedMinor: number;
  unresolvedMinor: number;
  findings: PolicyFinding[];
}
export interface ExpenseEvaluation extends AmountEvaluation {
  expenseKey: string;
  sourceAmountMinor: number;
  employeePaidCandidateMinor: number;
  companyPaidMemoMinor: number;
  excludedMinor: number;
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
export type Settlement =
  | { isFinal: true; payableMinor: number; recoverableMinor: number }
  | { isFinal: false; payableMinor: null; recoverableMinor: null };
export interface Readiness {
  isReadyToSubmit: boolean;
  blockingIssues: PolicyFinding[];
  warnings: PolicyFinding[];
  informational: PolicyFinding[];
}
