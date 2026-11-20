import { z } from "@hono/zod-openapi";

export const FLAG_KEY_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const FlagKeySchema = z
  .string()
  .min(2)
  .max(64)
  .regex(
    FLAG_KEY_PATTERN,
    "Use lowercase letters, digits and single hyphens, starting with a letter and not ending with a hyphen",
  )
  .openapi({ example: "new-checkout" });

export const FlagSchema = z
  .object({
    key: FlagKeySchema,
    name: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Flag");

export const FlagListSchema = z.object({ items: z.array(FlagSchema) }).openapi("FlagList");

// Strict: unknown fields are rejected, not ignored.
export const CreateFlagRequestSchema = z
  .strictObject({
    key: FlagKeySchema,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280).default(""),
  })
  .openapi("CreateFlagRequest");

export const SetFlagEnabledRequestSchema = z
  .strictObject({ enabled: z.boolean() })
  .openapi("SetFlagEnabledRequest");

export const FlagKeyParamSchema = z.object({
  key: z.string().openapi({ param: { name: "key", in: "path" }, example: "new-checkout" }),
});

export type Flag = z.infer<typeof FlagSchema>;
export type FlagList = z.infer<typeof FlagListSchema>;
export type CreateFlagRequest = z.infer<typeof CreateFlagRequestSchema>;
export type SetFlagEnabledRequest = z.infer<typeof SetFlagEnabledRequestSchema>;
