import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./client.ts";
import { createFlagRepository, type FlagRepository } from "./flag-repository.ts";
import { applyMigrations } from "./migrate.ts";

let repo: FlagRepository;

beforeEach(async () => {
  const db = createDb(":memory:");
  await applyMigrations(db);
  repo = createFlagRepository(db);
});

const input = { key: "dark-mode", name: "Dark mode", description: "" };

describe("flag repository", () => {
  it("reports a duplicate key as a conflict, not a thrown driver error", async () => {
    await repo.create(input);

    expect(await repo.create(input)).toEqual({ ok: false, reason: "key_conflict" });
  });

  it("lists flags ordered by key", async () => {
    await repo.create({ ...input, key: "zeta" });
    await repo.create({ ...input, key: "alpha" });

    expect((await repo.list()).map((row) => row.key)).toEqual(["alpha", "zeta"]);
  });

  it("setEnabled changes the state once and returns undefined when nothing changes", async () => {
    await repo.create(input);

    expect(await repo.setEnabled("dark-mode", true)).toMatchObject({ enabled: true });
    expect(await repo.setEnabled("dark-mode", true)).toBeUndefined();
    expect(await repo.setEnabled("missing", true)).toBeUndefined();
  });
});
