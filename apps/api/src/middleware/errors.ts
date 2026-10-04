import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

/** Error codes and statuses from ARCHITECTURE §8. */
export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'PAYLOAD_TOO_LARGE' | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL: 500,
};

export class HttpError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

/** Parses `value` with `schema` or throws a 400 with the zod issues as details. */
export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      'VALIDATION_ERROR',
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
      result.error.issues,
    );
  }
  return result.data;
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError('NOT_FOUND', `no route for ${req.method} ${req.path}`));
}

/** Body-parser errors carry a `type`; everything else unknown is a 500. */
function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.too.large') return new HttpError('PAYLOAD_TOO_LARGE', 'request body too large');
  if (type === 'entity.parse.failed')
    return new HttpError('VALIDATION_ERROR', 'request body is not valid JSON');
  return new HttpError('INTERNAL', 'internal server error');
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const httpError = toHttpError(err);
  if (httpError.status >= 500) req.log.error({ err }, 'request failed');
  res.status(httpError.status).json({
    error: {
      code: httpError.code,
      message: httpError.message,
      ...(httpError.details !== undefined ? { details: httpError.details } : {}),
    },
    requestId: String(req.id),
  });
}

/** Express 4 does not forward rejected promises from handlers; this wrapper does. */
export function handle(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}
