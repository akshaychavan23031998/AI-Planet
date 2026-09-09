import type {
  Claim,
  ClaimValidation,
  ClaimReadiness,
  ClaimSettlement,
  PolicyFinding,
} from '../api/claimTypes';
import { tripId, people, expenses, evidence } from './fixtures';
export const claimId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
export const claimExpenses = expenses.map((item, index) => ({
  ...item,
  componentType: index === 13 ? 'HOTEL_MIXED_TAX' : item.componentType,
}));
export const dinner = claimExpenses[6]!;
export const hotelTax = claimExpenses[13]!;
export const initialClaim: Claim = {
  id: claimId,
  employee: people[0]!,
  travelRequest: tripId,
  currency: 'INR',
  status: 'DRAFT',
  reviewCycle: 0,
  expenseCount: 14,
  finance: null,
  approvals: [],
  workflowHistory: [],
  reviewRoute: [],
  expenseReviews: [],
  expenseReviewHistory: [],
};
export const dinnerFinding: PolicyFinding = {
  code: 'BUSINESS_ENTERTAINMENT_ATTENDEE_NAMES_MISSING',
  severity: 'BLOCKING',
  message: 'Dinner attendee names are missing.',
  policyReference: 'Policy §4',
  blocking: true,
  userActionRequired: true,
  historicalException: false,
  expenseKey: dinner.id,
  evidenceKeys: dinner.sourceEvidence,
};
export const taxFinding: PolicyFinding = {
  code: 'HOTEL_TAX_ALLOCATION_UNRESOLVED',
  severity: 'BLOCKING',
  message: 'Mixed hotel tax requires an explicit allocation.',
  policyReference: 'Policy §3',
  blocking: true,
  userActionRequired: true,
  historicalException: false,
  expenseKey: hotelTax.id,
  evidenceKeys: hotelTax.sourceEvidence,
};
export const historicalFinding: PolicyFinding = {
  code: 'MISSING_PRETRAVEL_HOD_APPROVAL',
  severity: 'WARNING',
  message: 'Historical HOD approval is not recorded.',
  policyReference: 'Policy §2',
  blocking: false,
  userActionRequired: false,
  historicalException: true,
  evidenceKeys: [evidence[1]!.id],
};
export const initialValidation: ClaimValidation = {
  findings: [dinnerFinding, taxFinding, historicalFinding],
  claimedValueMinor: 2648804,
  claimApprovalBasisIsProvisional: true,
  requiredClaimApprovalLevels: ['REPORTING_MANAGER', 'HEAD_OF_DEPARTMENT'],
  expenseResults: claimExpenses.map((expense, index) => ({
    expenseKey: expense.id,
    sourceAmountMinor: expense.amountMinor,
    knownEligibleMinor: [
      0, 0, 141502, 74300, 17200, 122902, 0, 575000, 575000, 575000, 0, 0,
      112000, 0,
    ][index]!,
    knownDisallowedMinor: index === 10 ? 45000 : index === 11 ? 38000 : 0,
    unresolvedMinor: index === 6 ? 225500 : index === 13 ? 230400 : 0,
    excludedMinor: 0,
    findings: index === 6 ? [dinnerFinding] : index === 13 ? [taxFinding] : [],
    status:
      index < 2
        ? 'COMPANY_PAID'
        : index === 6 || index === 13
          ? 'UNRESOLVED'
          : index === 10 || index === 11
            ? 'DISALLOWED'
            : 'ELIGIBLE',
  })),
};
export const initialReadiness: ClaimReadiness = {
  isReadyToSubmit: false,
  blockingIssues: [dinnerFinding, taxFinding],
  warnings: [historicalFinding],
  informational: [],
};
export const initialSettlement: ClaimSettlement = {
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
