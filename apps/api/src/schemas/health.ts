import { z } from "@hono/zod-openapi";

export const HealthResponseSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    version: z.string(),
    database: z.enum(["ok", "unavailable", "disabled"]),
  })
  .openapi("HealthResponse");

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
