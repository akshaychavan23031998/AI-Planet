export function assertMinor(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Money must be nonnegative safe integer paise');
}
export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => {
    assertMinor(value);
    const next = total + value;
    assertMinor(next);
    return next;
  }, 0);
}
export function isBusinessDate(value: string | null): value is string {
  return (
    value !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function timestamp(value: string): number {
  if (
    !isBusinessDate(value.slice(0, 10)) ||
    !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new RangeError('Timestamp must include a valid timezone offset');
  }
  return Date.parse(value);
}
