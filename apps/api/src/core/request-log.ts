import { createMiddleware } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import { logger } from "./logger.ts";

/**
 * One structured line per request. Path only (no query string) and never the body,
 * so logs cannot pick up tokens or personal data from the request.
 */
export const requestLog = createMiddleware<{ Variables: RequestIdVariables }>(async (c, next) => {
  const start = performance.now();
  await next();
  logger.info(
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - start),
    },
    "request completed",
  );
});
