import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { createDb } from "../db/client.ts";
import { applyMigrations } from "../db/migrate.ts";

const db = createDb(":memory:");

beforeAll(async () => {
  await applyMigrations(db);
});

describe("GET /api/v1/health", () => {
  it("reports ok", async () => {
    const app = createApp({ db });

    const response = await app.request("/api/v1/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      database: "ok",
    });
  });

  it("returns the error shape for unknown routes", async () => {
    const app = createApp({ db });

    const response = await app.request("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });
  });
});
