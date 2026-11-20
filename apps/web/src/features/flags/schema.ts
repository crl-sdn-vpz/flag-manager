import { z } from "zod";

// Mirrors the API's CreateFlagRequest rules for instant feedback; the server stays authoritative.
export const createFlagFormSchema = z.object({
  key: z
    .string()
    .min(2, "Use at least 2 characters")
    .max(64, "Use at most 64 characters")
    .regex(
      /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
      "Lowercase letters, digits and single hyphens; start with a letter, don't end with a hyphen",
    ),
  name: z.string().trim().min(1, "Enter a name").max(80, "Use at most 80 characters"),
  description: z.string().trim().max(280, "Use at most 280 characters"),
});

export type CreateFlagFormValues = z.infer<typeof createFlagFormSchema>;

/** Shape of `details.issues` in a 422 response, parsed rather than trusted. */
export const validationIssuesSchema = z.array(
  z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }),
);
