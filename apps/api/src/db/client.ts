import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

export function createDb(url: string) {
  return drizzle(createClient({ url }), { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

/** SQLite creates the file but not its folder; do that for local `file:` URLs. */
export function ensureDatabaseDir(url: string): void {
  if (!url.startsWith("file:")) return;
  mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
}
