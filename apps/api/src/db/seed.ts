import { count } from "drizzle-orm";
import { logger } from "../core/logger.ts";
import type { Db } from "./client.ts";
import { flags, type NewFlagRow } from "./schema.ts";

const SAMPLE_FLAGS: NewFlagRow[] = [
  {
    key: "ai-summaries",
    name: "AI summaries",
    description: "Show generated summaries on long order notes.",
    enabled: false,
  },
  {
    key: "beta-search",
    name: "Beta search",
    description: "Route catalog search to the new ranking service.",
    enabled: true,
  },
  {
    key: "dark-mode",
    name: "Dark mode",
    description: "Offer a dark colour scheme in account settings.",
    enabled: true,
  },
  {
    key: "legacy-export",
    name: "Legacy CSV export",
    description: "Keep the old CSV export while customers migrate.",
    enabled: false,
  },
  {
    key: "new-checkout",
    name: "New checkout",
    description: "Single-page checkout with saved payment methods.",
    enabled: false,
  },
];

/** First run: give the UI something realistic to show. Never touches a database that has flags. */
export async function seedIfEmpty(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    const [result] = await tx.select({ total: count() }).from(flags);
    if (result && result.total > 0) return;
    await tx.insert(flags).values(SAMPLE_FLAGS);
    logger.info({ flags: SAMPLE_FLAGS.length }, "seeded sample flags");
  });
}
