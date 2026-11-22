import { createHash } from "node:crypto";
import type { Db } from "../db/client.ts";
import { createFlagRepository } from "../db/flag-repository.ts";
import type { FlagSnapshot } from "../schemas/eval.ts";

/** The states of every flag, and a version that identifies them. */
export async function getFlagSnapshot(db: Db): Promise<FlagSnapshot> {
  const rows = await createFlagRepository(db).list();
  return {
    version: versionOf(rows),
    flags: Object.fromEntries(rows.map((row) => [row.key, row.enabled])),
  };
}

/**
 * First 16 hex characters of the SHA-256 of the sorted lines `key=0|1`, joined with `\n`.
 *
 * It covers what a reader can see, the keys and their states, and nothing else: the same
 * answer always has the same version. `updatedAt` is left out on purpose. It also moves when
 * a flag is switched on and off again, which would change the version (and make every cache
 * refetch) for an answer that did not change. Flag keys cannot contain `=` or a newline.
 */
function versionOf(rows: { key: string; enabled: boolean }[]): string {
  const lines = rows.map((row) => `${row.key}=${row.enabled ? 1 : 0}`).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}
