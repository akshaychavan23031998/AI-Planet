import { ConfigurationError } from './api/errors';
export function apiBaseUrl(
  value: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
): string {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new ConfigurationError();
  }
}
