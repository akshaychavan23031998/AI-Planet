import { Schema, model } from 'mongoose';
import {
  currency,
  dateOnly,
  moneyMinor,
  nonNegativeInteger,
  relativePath,
  requiredText,
  seededFields,
} from '../schemaFields.js';

export const classifications = [
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
] as const;
export const relationshipTypes = [
  'HAS_REPLY',
  'RESOLVED_BY',
  'DUPLICATE_OF',
  'HAS_ATTACHMENT',
  'FINALIZED_BY',
] as const;
const addressSchema = new Schema(
  { name: String, address: requiredText },
  { _id: false, strict: 'throw' },
);
const relationshipSchema = new Schema(
  {
    type: { type: String, enum: relationshipTypes, required: true },
    evidence: { type: Schema.Types.ObjectId, ref: 'Evidence', required: true },
  },
  { _id: false, strict: 'throw' },
);
const attachmentSchema = new Schema(
  {
    filename: requiredText,
    mimeType: requiredText,
    sourceRelativePath: relativePath,
    representation: {
      type: String,
      enum: ['EXTERNAL_PACK_POINTER'],
      required: true,
    },
  },
  { _id: false, strict: 'throw' },
);
const receiptLineSchema = new Schema(
  {
    description: requiredText,
    amountMinor: moneyMinor,
    date: dateOnly,
    quantity: nonNegativeInteger,
  },
  { _id: false, strict: 'throw' },
);
const receiptMetadataSchema = new Schema(
  {
    method: { type: String, enum: ['CANONICAL_DOCUMENT'], required: true },
    canonicalReference: relativePath,
    merchant: requiredText,
    documentNumber: requiredText,
    gstin: String,
    currency,
    totalMinor: moneyMinor,
    subtotalMinor: moneyMinor,
    receiptDate: dateOnly,
    occurredAt: Date,
    cardLastFour: { type: String, match: /^\d{4}$/ },
    covers: nonNegativeInteger,
    attendeeOrganization: String,
    guestName: String,
    checkInAt: Date,
    checkOutAt: Date,
    nights: nonNegativeInteger,
    room: String,
    balanceDueMinor: nonNegativeInteger,
    lines: [receiptLineSchema],
  },
  { _id: false, strict: 'throw' },
);
const evidenceSchema = new Schema(
  {
    ...seededFields,
    travelRequest: {
      type: Schema.Types.ObjectId,
      ref: 'TravelRequest',
      required: true,
    },
    kind: { type: String, enum: ['EMAIL', 'IMAGE'], required: true },
    sourceFilename: requiredText,
    sourceRelativePath: relativePath,
    mimeType: requiredText,
    messageId: { type: String, unique: true, sparse: true },
    subject: String,
    sender: addressSchema,
    to: [addressSchema],
    cc: [addressSchema],
    receivedAt: Date,
    bodyText: String,
    classification: { type: String, enum: classifications, required: true },
    contentHashSha256: { ...requiredText, match: /^[a-f0-9]{64}$/ },
    parentEvidence: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      default: null,
    },
    relationships: [relationshipSchema],
    attachments: [attachmentSchema],
    assetReference: { ...relativePath, required: false },
    receiptMetadata: receiptMetadataSchema,
  },
  { timestamps: true, strict: 'throw' },
);
export const Evidence = model('Evidence', evidenceSchema);
