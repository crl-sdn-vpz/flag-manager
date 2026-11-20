import { z } from "zod";

// The only place that reads process.env. `just` loads the root .env.
const EnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  API_PORT: z.coerce.number().int().positive().default(8000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().default("file:./data/app.db"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse({
  ...process.env,
  LOG_LEVEL: process.env.LOG_LEVEL?.toLowerCase(),
});
