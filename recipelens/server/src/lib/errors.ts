/**
 * Application error type. Everything the client sees goes through here, so
 * stack traces and internal details never leak out of the API.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VERSION_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'GOOGLE_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_INVALID_RESPONSE'
  | 'SOURCE_UNREACHABLE'
  | 'SOURCE_UNSUPPORTED'
  | 'INSUFFICIENT_SOURCE_DATA'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorOptions {
  details?: unknown;
  /** Suggested next actions the UI can offer the user. */
  recovery?: string[];
  cause?: unknown;
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly recovery?: string[];
  readonly retryable: boolean;

  constructor(status: number, code: ErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause == null ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.recovery = options.recovery;
    this.retryable = options.retryable ?? status >= 500;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
        ...(this.recovery === undefined ? {} : { recovery: this.recovery }),
        retryable: this.retryable,
      },
    };
  }
}

export const badRequest = (message: string, options?: ApiErrorOptions) => new ApiError(400, 'BAD_REQUEST', message, options);
export const unauthorized = (message = 'Authentication required.') => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this resource.') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code: ErrorCode = 'CONFLICT') => new ApiError(409, code, message);
