import { Schema, model } from 'mongoose';
import {
  currency,
  dateOnly,
  nonNegativeInteger,
  requiredText,
  seededFields,
} from '../schemaFields.js';
import { organizationalRoles } from '../employees/employee.model.js';
import {
  businessLevels,
  claimStatuses,
  workflowActions,
} from '../../domain/claims/types.js';

const employeeRef = {
  type: Schema.Types.ObjectId,
  ref: 'Employee',
  required: true,
} as const;
const cycle = { ...nonNegativeInteger, required: true } as const;
const approvalSchema = new Schema(
  {
    approver: employeeRef,
    level: { type: String, enum: businessLevels, required: true },
    decision: { type: String, enum: ['APPROVED', 'RETURNED'], required: true },
    decidedAt: { type: Date, required: true },
    remarks: String,
    reviewCycle: cycle,
  },
  { _id: false, strict: 'throw' },
);
const workflowEventSchema = new Schema(
  {
    action: { type: String, enum: workflowActions, required: true },
    fromStatus: { type: String, enum: claimStatuses, required: true },
    toStatus: { type: String, enum: claimStatuses, required: true },
    actor: employeeRef,
    actorRole: { type: String, enum: organizationalRoles, required: true },
    occurredAt: { type: Date, required: true },
    remarks: String,
    reviewCycle: cycle,
  },
  { _id: false, strict: 'throw' },
);
const routeSchema = new Schema(
  {
    level: { type: String, enum: businessLevels, required: true },
    employeeId: employeeRef,
  },
  { _id: false, strict: 'throw' },
);
const financeSchema = new Schema(
  {
    verifiedBy: employeeRef,
    verifiedAt: { type: Date, required: true },
    reviewCycle: cycle,
    paymentScheduledFor: dateOnly,
    paymentScheduledBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
    paidAt: Date,
    paymentReference: String,
  },
  { _id: false, strict: 'throw' },
);
const claimSchema = new Schema(
  {
    ...seededFields,
    travelRequest: {
      type: Schema.Types.ObjectId,
      ref: 'TravelRequest',
      required: true,
    },
    employee: employeeRef,
    currency,
    expenses: [{ type: Schema.Types.ObjectId, ref: 'Expense', required: true }],
    status: { type: String, enum: claimStatuses, required: true },
    reviewCycle: { ...cycle, default: 0 },
    workflowVersion: { ...nonNegativeInteger, required: true, default: 0 },
    approvals: { type: [approvalSchema], default: [] },
    workflowHistory: { type: [workflowEventSchema], default: [] },
    reviewRoute: { type: [routeSchema], default: [] },
    reviewInputHash: {
      default: null,
      ...requiredText,
      required: false,
      match: /^[a-f0-9]{64}$/,
    },
    finance: { type: financeSchema, default: null },
  },
  { timestamps: true, strict: 'throw' },
);
export const Claim = model('Claim', claimSchema);
