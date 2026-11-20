import { LibsqlError } from "@libsql/client";
import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "./client.ts";
import { type FlagRow, flags } from "./schema.ts";

export type NewFlag = { key: string; name: string; description: string };

export type CreateFlagResult = { ok: true; row: FlagRow } | { ok: false; reason: "key_conflict" };

export type FlagRepository = {
  list(): Promise<FlagRow[]>;
  get(key: string): Promise<FlagRow | undefined>;
  create(flag: NewFlag): Promise<CreateFlagResult>;
  /** Returns the updated row, or undefined if the flag is missing or already in that state. */
  setEnabled(key: string, enabled: boolean): Promise<FlagRow | undefined>;
};

export function createFlagRepository(db: Db): FlagRepository {
  return {
    list: () => db.select().from(flags).orderBy(asc(flags.key)),

    get: async (key) => {
      const [row] = await db.select().from(flags).where(eq(flags.key, key));
      return row;
    },

    create: async (flag) => {
      const now = new Date();
      try {
        const [row] = await db
          .insert(flags)
          .values({ ...flag, enabled: false, createdAt: now, updatedAt: now })
          .returning();
        if (!row) throw new Error("insert returned no row");
        return { ok: true, row };
      } catch (error) {
        // The primary key enforces uniqueness, so two concurrent creates cannot both succeed.
        if (isUniqueViolation(error)) return { ok: false, reason: "key_conflict" };
        throw error;
      }
    },

    // One statement: the "did it change?" check and the write cannot interleave with another request.
    setEnabled: async (key, enabled) => {
      const [row] = await db
        .update(flags)
        .set({ enabled, updatedAt: new Date() })
        .where(and(eq(flags.key, key), ne(flags.enabled, enabled)))
        .returning();
      return row;
    },
  };
}

/** Drizzle wraps driver errors; the libsql error is the cause. */
function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  return (
    cause instanceof LibsqlError &&
    (cause.extendedCode === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
      cause.extendedCode === "SQLITE_CONSTRAINT_UNIQUE")
  );
}
