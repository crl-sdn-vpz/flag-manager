import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

export function createDb(url: string) {
  return drizzle(createClient({ url }), { schema });
}

export type Db = ReturnType<typeof createDb>;
