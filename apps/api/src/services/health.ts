import { sql } from "drizzle-orm";
import { logger } from "../core/logger.ts";
import type { Db } from "../db/client.ts";
import type { HealthResponse } from "../schemas/health.ts";

export async function checkHealth(db: Db, version: string): Promise<HealthResponse> {
  try {
    await db.run(sql`select 1`);
  } catch (error) {
    logger.warn({ err: error }, "database health check failed");
    return { status: "degraded", version, database: "unavailable" };
  }
  return { status: "ok", version, database: "ok" };
}
