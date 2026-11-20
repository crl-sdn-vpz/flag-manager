import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { env } from "./core/env.ts";
import { errorBody, toErrorResponse } from "./core/errors.ts";
import { logger } from "./core/logger.ts";
import type { Db } from "./db/client.ts";
import { registerHealthRoutes } from "./routes/health.ts";

export type AppDeps = {
  db: Db;
  version?: string;
};

export type AppEnv = { Variables: { deps: Required<AppDeps> } };

export function createApp(deps: AppDeps) {
  const resolved: Required<AppDeps> = { version: "0.1.0", ...deps };
  const app = new OpenAPIHono<AppEnv>({
    // Validation failures use the same error shape as every other error.
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          errorBody("validation_error", "Request validation failed", {
            issues: result.error.issues,
          }),
          422,
        );
      }
    },
  });

  app.use("*", cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use("*", async (c, next) => {
    c.set("deps", resolved);
    await next();
  });

  const v1 = new OpenAPIHono<AppEnv>();
  registerHealthRoutes(v1);
  app.route("/api/v1", v1);

  app.notFound((c) => c.json(errorBody("not_found", "Route not found"), 404));
  app.onError((error, c) => {
    const { status, body } = toErrorResponse(error);
    if (status >= 500) logger.error({ err: error }, "unhandled error");
    return c.json(body, status);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
