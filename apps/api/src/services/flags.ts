import { FlagKeyConflictError, FlagNotFoundError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";
import type { Db } from "../db/client.ts";
import { createFlagRepository } from "../db/flag-repository.ts";
import type { FlagRow } from "../db/schema.ts";
import type { CreateFlagRequest, Flag, FlagList } from "../schemas/flags.ts";

export type RequestContext = { requestId: string };

// No auth yet: the field exists so adding it later does not change the log shape.
const ACTOR = "anonymous";

export async function listFlags(db: Db): Promise<FlagList> {
  const rows = await createFlagRepository(db).list();
  return { items: rows.map(toFlag) };
}

/** New flags always start disabled: creating a flag must never change behaviour by itself. */
export async function createFlag(
  db: Db,
  input: CreateFlagRequest,
  ctx: RequestContext,
): Promise<Flag> {
  const result = await createFlagRepository(db).create(input);
  if (!result.ok) throw new FlagKeyConflictError(input.key);

  logFlagEvent("flag.created", result.row.key, null, result.row.enabled, ctx);
  return toFlag(result.row);
}

/** Sets (does not flip) the state, so repeating the request is safe. */
export async function setFlagEnabled(
  db: Db,
  key: string,
  enabled: boolean,
  ctx: RequestContext,
): Promise<Flag> {
  const repo = createFlagRepository(db);
  const changed = await repo.setEnabled(key, enabled);
  if (changed) {
    logFlagEvent("flag.state_changed", key, !enabled, enabled, ctx);
    return toFlag(changed);
  }

  // Nothing changed: either the flag is missing or it was already in this state.
  const current = await repo.get(key);
  if (!current) throw new FlagNotFoundError(key);
  return toFlag(current);
}

function logFlagEvent(
  event: "flag.created" | "flag.state_changed",
  flagKey: string,
  oldEnabled: boolean | null,
  newEnabled: boolean,
  ctx: RequestContext,
): void {
  logger.info(
    { event, flagKey, oldEnabled, newEnabled, actor: ACTOR, requestId: ctx.requestId },
    event,
  );
}

function toFlag(row: FlagRow): Flag {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
