import { Schema, model } from 'mongoose';
import {
  currency,
  dateOnly,
  moneyMinor,
  nonNegativeInteger,
  requiredText,
  seededFields,
} from '../schemaFields.js';
import { organizationalRoles } from '../employees/employee.model.js';

const preTravelApprovalSchema = new Schema(
  {
    approver: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    role: { type: String, enum: organizationalRoles, required: true },
    decision: { type: String, enum: ['APPROVED'], required: true },
    approvedAt: { type: Date, required: true },
    evidence: { type: Schema.Types.ObjectId, ref: 'Evidence', required: true },
  },
  { _id: false, strict: 'throw' },
);
const travelRequestSchema = new Schema(
  {
    ...seededFields,
    travelRequestId: { type: String, default: null },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    origin: requiredText,
    destination: requiredText,
    startDate: { ...dateOnly, required: true },
    endDate: { ...dateOnly, required: true },
    purpose: requiredText,
    travelType: {
      type: String,
      enum: ['DOMESTIC', 'INTERNATIONAL'],
      required: true,
    },
    costCentre: requiredText,
    currency,
    estimatedSpendMinor: moneyMinor,
    advanceRequestedMinor: moneyMinor,
    advanceDisbursedMinor: moneyMinor,
    advanceReference: String,
    advanceDisbursedDate: dateOnly,
    advanceNotifiedAt: Date,
    advanceEvidence: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
    plannedLodgingNights: { ...nonNegativeInteger, required: true },
    evidencedLodgingNights: nonNegativeInteger,
    preTravelApprovals: { type: [preTravelApprovalSchema], default: [] },
    sourceNotes: [String],
  },
  { timestamps: true, strict: 'throw' },
);
export const TravelRequest = model('TravelRequest', travelRequestSchema);
