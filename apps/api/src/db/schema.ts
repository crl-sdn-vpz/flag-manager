// Drizzle schema: one table builder per table. Generate a migration after every change:
//   just db-revision "describe the change"
import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

/** Spread into every table: UTC created_at / updated_at (unix epoch seconds). */
export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};
