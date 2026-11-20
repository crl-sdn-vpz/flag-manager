import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../app.ts";
import { ErrorResponseSchema } from "../schemas/errors.ts";
import { HealthResponseSchema } from "../schemas/health.ts";
import { checkHealth } from "../services/health.ts";

const getHealthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "get_health",
  tags: ["health"],
  responses: {
    200: {
      description: "Service health",
      content: { "application/json": { schema: HealthResponseSchema } },
    },
    500: {
      description: "Unexpected error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export function registerHealthRoutes(app: OpenAPIHono<AppEnv>): void {
  app.openapi(getHealthRoute, async (c) => {
    const { db, version } = c.get("deps");
    return c.json(await checkHealth(db, version), 200);
  });
}
