import { z } from "@hono/zod-openapi";

export const ErrorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  })
  .openapi("ErrorResponse");
