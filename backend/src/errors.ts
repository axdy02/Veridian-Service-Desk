import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

export function asyncRoute(
  route: (request: Request, response: Response, next: NextFunction) => Promise<void>
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void route(request, response, next).catch(next);
  };
}

export function errorMiddleware(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  const requestId = response.locals.requestId as string;
  if (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 400) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.', requestId } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'One or more fields are invalid.', requestId, details: error.flatten() }
    });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, requestId, ...(error.details ? { details: error.details } : {}) }
    });
    return;
  }
  const databaseFailure = typeof error === 'object' && error !== null && 'code' in error;
  response.status(databaseFailure ? 503 : 500).json({
    error: {
      code: databaseFailure ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
      message: databaseFailure ? 'The service database is temporarily unavailable.' : 'An unexpected error occurred.',
      requestId
    }
  });
}
