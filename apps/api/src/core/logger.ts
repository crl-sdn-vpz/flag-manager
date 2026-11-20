import { pino } from "pino";
import { env } from "./env.ts";

// Structured JSON logs. Never log tokens, passwords or personal data.
export const logger = pino({ level: env.LOG_LEVEL, base: { service: "api" } });
