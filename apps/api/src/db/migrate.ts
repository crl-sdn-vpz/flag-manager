import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client.ts";

// fileURLToPath, not URL.pathname: on Windows pathname gives "/C:/..." which fs can't open.
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Apply all committed migrations: on API startup and in tests (the CLI uses `just db-upgrade`). */
export async function applyMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}
