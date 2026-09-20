import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors.js';

type Bucket = { count: number; resetAt: number };

/** Small in-process guard for the single-instance demo API. It intentionally does
 * not claim distributed rate limiting, and is never used as an authorization check. */
export function createRateLimit(options: { windowMs: number; max: number; key: (request: Request) => string }) {
  const buckets = new Map<string, Bucket>();
  return (request: Request, _response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.key(request);
    const previous = buckets.get(key);
    const bucket = !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : previous;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > options.max) {
      next(new AppError(429, 'RATE_LIMITED', 'Please wait before trying again.'));
      return;
    }
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    next();
  };
}

export function clientAddress(request: Request): string {
  return request.socket.remoteAddress ?? 'unknown';
}
