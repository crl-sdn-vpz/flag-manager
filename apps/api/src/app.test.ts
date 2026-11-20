import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { createDb, type Db } from "./db/client.ts";
import { applyMigrations } from "./db/migrate.ts";

let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  await applyMigrations(db);
});

describe("request id", () => {
  it("generates one, returns it in the header and in the error body", async () => {
    const app = createApp({ db });

    const response = await app.request("/api/v1/does-not-exist");

    const header = response.headers.get("X-Request-Id");
    expect(header).toBeTruthy();
    expect(await response.json()).toEqual({
      code: "not_found",
      message: "Route not found",
      details: {},
      requestId: header,
    });
  });

  it("echoes a well-formed incoming id", async () => {
    const app = createApp({ db });

    const response = await app.request("/api/v1/does-not-exist", {
      headers: { "X-Request-Id": "trace-abc_123" },
    });

    expect(response.headers.get("X-Request-Id")).toBe("trace-abc_123");
    expect(await response.json()).toMatchObject({ requestId: "trace-abc_123" });
  });

  it("replaces a malformed incoming id", async () => {
    const app = createApp({ db });

    const response = await app.request("/api/v1/does-not-exist", {
      headers: { "X-Request-Id": "bad id; drop table" },
    });

    const header = response.headers.get("X-Request-Id");
    expect(header).not.toBe("bad id; drop table");
    expect(await response.json()).toMatchObject({ requestId: header });
  });
});
