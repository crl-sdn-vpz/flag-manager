import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.ts";
import { createFlagRepository } from "./flag-repository.ts";
import { applyMigrations } from "./migrate.ts";
import { seedIfEmpty } from "./seed.ts";

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await applyMigrations(db);
});

describe("seedIfEmpty", () => {
  it("seeds five flags, some on and some off, only once", async () => {
    await seedIfEmpty(db);
    await seedIfEmpty(db);

    const rows = await createFlagRepository(db).list();
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.enabled))).toEqual(new Set([true, false]));
  });

  it("leaves a database that already has flags alone", async () => {
    await createFlagRepository(db).create({ key: "mine", name: "Mine", description: "" });

    await seedIfEmpty(db);

    expect(await createFlagRepository(db).list()).toHaveLength(1);
  });
});
