import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z
    .string()
    .trim()
    .regex(/^mongodb(?:\+srv)?:\/\/\S+$/, 'Must be a MongoDB connection URI'),
  MONGODB_DB_NAME: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Must be a database name'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CLIENT_ORIGIN: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    }, 'CLIENT_ORIGIN must be an HTTP(S) origin without a path')
    .default('http://localhost:5173'),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const fields = result.error.issues.map((issue) => issue.path.join('.'));
  throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
}

export const env = result.data;
