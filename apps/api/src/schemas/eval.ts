import { z } from "@hono/zod-openapi";
import { FlagKeySchema } from "./flags.ts";

export const FlagSnapshotSchema = z
  .object({
    version: z
      .string()
      .regex(/^[0-9a-f]{16}$/)
      .openapi({
        description:
          "Identifies this exact set of states. Changes when a flag is created or toggled, and only then. Also the response's ETag.",
        example: "9f2c4a7e10b35d68",
      }),
    flags: z.record(FlagKeySchema, z.boolean()).openapi({
      description: "Every flag's state, by key",
      example: { "new-checkout": true, "beta-search": false },
    }),
  })
  .openapi("FlagSnapshot");

export const EvalRequestHeadersSchema = z.object({
  "if-none-match": z.string().optional().openapi({
    description: "The ETag of the snapshot the caller already has. A match answers 304.",
    example: '"9f2c4a7e10b35d68"',
  }),
});

export const EvalResponseHeadersSchema = z.object({
  ETag: z.string().openapi({
    description: "The snapshot's version in quotes. Send it back as If-None-Match.",
    example: '"9f2c4a7e10b35d68"',
  }),
  "Cache-Control": z.string().openapi({
    description: "no-cache: a cache may keep the answer but must revalidate it before using it.",
    example: "no-cache",
  }),
});

export type FlagSnapshot = z.infer<typeof FlagSnapshotSchema>;
