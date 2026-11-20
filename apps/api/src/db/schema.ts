// Drizzle schema: one table builder per table. Generate a migration after every change:
//   just db-revision "describe the change"
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Spread into every table: UTC created_at / updated_at (unix epoch seconds). */
export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

/** Feature flags. `key` is the identity: immutable, and unique by being the primary key. */
export const flags = sqliteTable("flags", {
  key: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(""),
  enabled: integer({ mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export type FlagRow = typeof flags.$inferSelect;
export type NewFlagRow = typeof flags.$inferInsert;
