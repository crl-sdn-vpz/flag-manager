import { DrizzleQueryError } from "drizzle-orm/errors";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorBody = {
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
};

/** The one error shape. `requestId` ties a response to its log lines (docs/adr/0002). */
export function errorBody(
  code: string,
  message: string,
  requestId: string,
  details: Record<string, unknown> = {},
): ErrorBody {
  return { code, message, details, requestId };
}

/** Domain errors: services throw these; app.onError maps them to HTTP in one place. */
export class DomainError extends Error {
  readonly status: ContentfulStatusCode = 400;
  readonly code: string = "bad_request";
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.details = details;
  }
}

export class NotFoundError extends DomainError {
  override readonly status = 404;
  override readonly code = "not_found";
}

export class ConflictError extends DomainError {
  override readonly status = 409;
  override readonly code = "conflict";
}

export class ForbiddenError extends DomainError {
  override readonly status = 403;
  override readonly code = "forbidden";
}

export function toErrorResponse(
  error: Error,
  requestId: string,
): { status: ContentfulStatusCode; body: ErrorBody } {
  if (error instanceof DomainError) {
    return {
      status: error.status,
      body: errorBody(error.code, error.message, requestId, error.details),
    };
  }
  if (error instanceof HTTPException) {
    return { status: error.status, body: errorBody("http_error", error.message, requestId) };
  }
  return { status: 500, body: errorBody("internal_error", "Internal server error", requestId) };
}

export class FlagNotFoundError extends DomainError {
  override readonly status = 404;
  override readonly code = "flag_not_found";

  constructor(key: string) {
    super(`No flag with key "${key}"`, { key });
  }
}

export class FlagKeyConflictError extends DomainError {
  override readonly status = 409;
  override readonly code = "flag_key_conflict";

  constructor(key: string) {
    super(`A flag with key "${key}" already exists`, { key });
  }
}

/**
 * A log-safe summary of an unexpected error. Drizzle's query errors carry the bound
 * parameters (user input) in `params` and in `message`, so log the SQL and the driver's
 * reason instead, never the values.
 */
export function toLoggableError(error: Error): Record<string, unknown> {
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause instanceof Error ? error.cause : undefined;
    return {
      name: error.name,
      query: error.query,
      cause: cause && { name: cause.name, message: cause.message, code: errorCode(cause) },
      stack: cause?.stack,
    };
  }
  return { name: error.name, message: error.message, stack: error.stack };
}

function errorCode(error: Error): unknown {
  return "code" in error ? error.code : undefined;
}
