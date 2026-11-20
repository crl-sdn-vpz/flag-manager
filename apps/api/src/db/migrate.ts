import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client.ts";

const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

/** Apply all committed migrations (used by tests; the CLI uses `just db-upgrade`). */
export async function applyMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}
