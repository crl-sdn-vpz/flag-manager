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
