import { Schema, model } from 'mongoose';
import {
  currency,
  dateOnly,
  moneyMinor,
  nonNegativeInteger,
  requiredText,
  seededFields,
} from '../schemaFields.js';

const detailsSchema = new Schema(
  {
    origin: String,
    destination: String,
    flightNumber: String,
    pnr: String,
    bookingReference: String,
    invoiceNumber: String,
    paymentMethod: String,
    cardLastFour: { type: String, match: /^\d{4}$/ },
    covers: nonNegativeInteger,
    attendeeOrganization: String,
    baseFareMinor: nonNegativeInteger,
    taxesAndFeesMinor: nonNegativeInteger,
    airportSurchargeMinor: nonNegativeInteger,
  },
  { _id: false, strict: 'throw' },
);
const expenseSchema = new Schema(
  {
    ...seededFields,
    travelRequest: {
      type: Schema.Types.ObjectId,
      ref: 'TravelRequest',
      required: true,
    },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    category: {
      type: String,
      enum: [
        'AIR_TRAVEL',
        'LODGING',
        'LOCAL_CONVEYANCE',
        'MEAL',
        'BUSINESS_ENTERTAINMENT',
        'OTHER',
      ],
      required: true,
    },
    componentType: {
      type: String,
      enum: [
        'FLIGHT_SECTOR',
        'RIDE',
        'DINNER',
        'ROOM',
        'LAUNDRY',
        'MINIBAR',
        'IN_ROOM_DINING',
        'HOTEL_MIXED_TAX',
      ],
      required: true,
    },
    expenseDate: { ...dateOnly, default: null },
    occurredAt: Date,
    merchant: requiredText,
    description: requiredText,
    amountMinor: moneyMinor,
    currency,
    paidBy: { type: String, enum: ['EMPLOYEE', 'COMPANY'], required: true },
    sourceEvidence: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Evidence', required: true }],
      required: true,
      validate: (refs: unknown[]) => refs.length > 0,
    },
    sourceReviewState: {
      type: String,
      enum: ['CLEAR', 'NEEDS_REVIEW'],
      required: true,
    },
    sourceReviewNote: String,
    details: detailsSchema,
  },
  { timestamps: true, strict: 'throw' },
);
export const Expense = model('Expense', expenseSchema);
