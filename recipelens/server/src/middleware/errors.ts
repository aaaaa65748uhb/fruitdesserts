import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';
import { getContext } from './context.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(new ApiError(404, 'NOT_FOUND', 'Unknown endpoint.').toJSON());
};

/** Turns anything thrown anywhere into a safe JSON error envelope. */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    apiError = new ApiError(422, 'VALIDATION_FAILED', 'Some of the submitted values are invalid.', {
      details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  } else if (isBodyParserError(error)) {
    apiError =
      error.type === 'entity.too.large'
        ? new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.')
        : new ApiError(400, 'BAD_REQUEST', 'The request body could not be parsed as JSON.');
  } else {
    apiError = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }

  if (apiError.status >= 500) {
    // Log the cause server-side only — the client never sees internals.
    const ctx = safeContext(req);
    if (!ctx?.config.isTest) {
      console.error('[error]', req.method, req.originalUrl, apiError.code, error instanceof Error ? error.stack : error);
    }
  }

  res.status(apiError.status).json(apiError.toJSON());
};

function safeContext(req: Parameters<ErrorRequestHandler>[1]) {
  try {
    return getContext(req);
  } catch {
    return null;
  }
}

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof (error as BodyParserError).type === 'string' &&
    ((error as BodyParserError).type!.startsWith('entity.') || (error as BodyParserError).type === 'encoding.unsupported')
  );
}
