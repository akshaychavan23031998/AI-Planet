export const requiredText = {
  type: String,
  required: true,
  trim: true,
} as const;
export const nonNegativeInteger = {
  type: Number,
  min: 0,
  validate: Number.isSafeInteger,
} as const;
export const moneyMinor = { ...nonNegativeInteger, required: true } as const;
export const currency = {
  type: String,
  enum: ['INR'],
  required: true,
} as const;
export const dateOnly = {
  type: String,
  validate: (value: string | null | undefined) =>
    value == null ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value),
} as const;
export const relativePath = {
  ...requiredText,
  validate: (value: string) =>
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !value.includes(':') &&
    value
      .split('/')
      .every((part) => part !== '..' && part !== '.' && part.length > 0),
} as const;
export const seededFields = {
  seedKey: { ...requiredText, unique: true },
  sourceDataset: requiredText,
} as const;
