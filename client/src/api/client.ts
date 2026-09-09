import { apiBaseUrl } from '../config';
import { ApiError, NetworkError } from './errors';
interface RequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  employeeCode?: string;
  signal?: AbortSignal;
}
function backendError(
  value: unknown,
): value is { error: { code: string; message: string; details?: unknown } } {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}
export async function apiRequest<T>({
  path,
  method = 'GET',
  body,
  employeeCode,
  signal,
}: RequestOptions): Promise<T> {
  if (
    !path.startsWith('/api/v1/') ||
    path.includes('\\') ||
    path.includes('..')
  )
    throw new Error('Expected a versioned API path.');
  const url = `${apiBaseUrl()}${path}`;
  const headers = new Headers({ Accept: 'application/json' });
  if (employeeCode !== undefined) {
    if (!/^NX-\d{4}$/.test(employeeCode))
      throw new Error('A valid demo employee code is required.');
    headers.set('X-Demo-Employee-Code', employeeCode);
  }
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError')
    )
      throw error;
    throw new NetworkError();
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (
      signal?.aborted ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError')
    )
      throw error;
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unreadable response.',
    );
  }
  if (!response.ok) {
    if (backendError(payload))
      throw new ApiError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    throw new ApiError(
      response.status,
      'HTTP_ERROR',
      'The request could not be completed.',
    );
  }
  return payload as T;
}
