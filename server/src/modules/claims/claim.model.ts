import { Schema, model } from 'mongoose';
import { currency, seededFields } from '../schemaFields.js';
import { organizationalRoles } from '../employees/employee.model.js';

const approvalSchema = new Schema(
  {
    approver: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    role: { type: String, enum: organizationalRoles, required: true },
    decision: {
      type: String,
      enum: ['APPROVED', 'RETURNED', 'REJECTED'],
      required: true,
    },
    decidedAt: { type: Date, required: true },
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
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    currency,
    expenses: [{ type: Schema.Types.ObjectId, ref: 'Expense', required: true }],
    status: { type: String, enum: ['DRAFT'], required: true },
    approvals: { type: [approvalSchema], default: [] },
  },
  { timestamps: true, strict: 'throw' },
);
export const Claim = model('Claim', claimSchema);
