import type { Classification } from '../api/types';
export const classificationLabels: Record<Classification, string> = {
  SUPPORTING_TRIP: 'Supporting trip',
  APPROVAL: 'Approval',
  ADVANCE: 'Advance',
  COMPANY_PAID_COST: 'Company paid',
  EMPLOYEE_PAID_CANDIDATE: 'Employee-paid candidate',
  PAYMENT_FAILURE: 'Payment failure',
  DUPLICATE: 'Duplicate',
  NEEDS_REVIEW: 'Needs review',
  CLAIMANT_MISMATCH: 'Claimant mismatch',
  NOISE: 'Noise',
  SUPPORTING_DOCUMENT: 'Supporting document',
};
export function classificationVariant(
  value: Classification,
): 'neutral' | 'info' | 'warning' | 'danger' {
  if (value === 'PAYMENT_FAILURE' || value === 'CLAIMANT_MISMATCH')
    return 'danger';
  if (value === 'NEEDS_REVIEW' || value === 'DUPLICATE') return 'warning';
  if (value === 'NOISE') return 'neutral';
  return 'info';
}
