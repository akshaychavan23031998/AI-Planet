import { Schema, model } from 'mongoose';
import { requiredText } from '../schemaFields.js';

export const organizationalRoles = [
  'EMPLOYEE',
  'REPORTING_MANAGER',
  'HEAD_OF_DEPARTMENT',
  'HEAD_OF_DIVISION',
  'MANAGING_DIRECTOR',
  'FINANCE',
] as const;
const employeeSchema = new Schema(
  {
    employeeCode: { ...requiredText, unique: true },
    name: requiredText,
    designation: requiredText,
    organizationalRole: {
      type: String,
      enum: organizationalRoles,
      required: true,
    },
    department: requiredText,
    costCentre: requiredText,
    city: requiredText,
    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    sourceDataset: requiredText,
  },
  { timestamps: true, strict: 'throw' },
);
export const Employee = model('Employee', employeeSchema);
