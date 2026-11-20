import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { type RequestIdVariables, requestId } from "hono/request-id";
import { env } from "./core/env.ts";
import { errorBody, toErrorResponse, toLoggableError } from "./core/errors.ts";
import { logger } from "./core/logger.ts";
import { requestLog } from "./core/request-log.ts";
import type { Db } from "./db/client.ts";
import { registerFlagRoutes } from "./routes/flags.ts";
import { registerHealthRoutes } from "./routes/health.ts";

export type AppDeps = {
  db: Db;
  version?: string;
};

export type AppEnv = { Variables: { deps: Required<AppDeps> } & RequestIdVariables };

export function createApp(deps: AppDeps) {
  const resolved: Required<AppDeps> = { version: "0.1.0", ...deps };
  const app = new OpenAPIHono<AppEnv>({
    // Validation failures use the same error shape as every other error.
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorBody("validation_error", "Request validation failed", c.get("requestId"), {
            issues: result.error.issues,
          }),
          422,
        );
      }
    },
  });

  // First, so every later middleware, handler and error path can read c.get("requestId").
  app.use("*", requestId());
  app.use("*", requestLog);
  app.use("*", cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use("*", async (c, next) => {
    c.set("deps", resolved);
    await next();
  });

  const v1 = new OpenAPIHono<AppEnv>();
  registerHealthRoutes(v1);
  registerFlagRoutes(v1);
  app.route("/api/v1", v1);

  app.notFound((c) => c.json(errorBody("not_found", "Route not found", c.get("requestId")), 404));
  app.onError((error, c) => {
    const { status, body } = toErrorResponse(error, c.get("requestId"));
    if (status >= 500) {
      logger.error({ err: toLoggableError(error), requestId: body.requestId }, "unhandled error");
    }
    return c.json(body, status);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
