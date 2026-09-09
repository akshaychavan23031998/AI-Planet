import { z } from 'zod';
import type { Request } from 'express';
import { isBusinessDate } from '../../domain/policy/money.js';
import { ApiError } from './errorMapping.js';
import type { ApiErrorCode } from './errorMapping.js';

export function parse<T>(
  schema: z.ZodType<T>,
  value: unknown,
  code: ApiErrorCode = 'INVALID_BODY',
): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(code, 'Request validation failed.', {
      fields: result.error.issues.map((item) => item.path.join('.')),
    });
  return result.data;
}
export const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/)
  .transform((value) => value.toLowerCase());
export function routeId(req: Request, name: string): string {
  return parse(objectId, req.params[name], 'INVALID_ID');
}
export const emptyBody = z.strictObject({}).default({});
export const emptyQuery = z.strictObject({});
export const remarksBody = z
  .strictObject({ remarks: z.string().trim().max(2000).optional() })
  .default({});
export const excludeBody = z.strictObject({
  reason: z.string().trim().min(1).max(2000),
});
export const resolutionBody = z.strictObject({
  reimbursableMinor: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER),
  disallowedMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  reason: z.string().trim().min(1).max(2000),
});
export const scheduleBody = z.strictObject({
  scheduledFor: z.string().refine(isBusinessDate),
});
export const paidBody = z
  .strictObject({ paymentReference: z.string().trim().max(200).optional() })
  .default({});
