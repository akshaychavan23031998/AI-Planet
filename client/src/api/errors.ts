export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export class NetworkError extends Error {
  readonly code = 'NETWORK_ERROR';
  constructor() {
    super('Unable to reach the server. Check your connection and try again.');
    this.name = 'NetworkError';
  }
}
export class ConfigurationError extends Error {
  constructor() {
    super('The API address is not configured correctly.');
    this.name = 'ConfigurationError';
  }
}
