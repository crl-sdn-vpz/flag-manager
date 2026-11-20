import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.ts";
import { createDb, type Db } from "../db/client.ts";
import { applyMigrations } from "../db/migrate.ts";
import { logger } from "./logger.ts";

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await applyMigrations(db);
});

describe("request log", () => {
  it("writes one structured line per request", async () => {
    const info = vi.spyOn(logger, "info").mockImplementation(() => undefined);
    const app = createApp({ db });

    const response = await app.request("/api/v1/does-not-exist?secret=x", {
      headers: { "X-Request-Id": "req-1" },
    });

    expect(response.status).toBe(404);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      {
        requestId: "req-1",
        method: "GET",
        path: "/api/v1/does-not-exist",
        status: 404,
        durationMs: expect.any(Number),
      },
      "request completed",
    );
  });
});
