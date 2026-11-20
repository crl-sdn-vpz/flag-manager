import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import { logger } from "./core/logger.ts";
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

describe("unexpected errors", () => {
  it("returns a bare 500 and logs the failure without query values or SQL in the response", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    // No migrations: the flags table is missing, so the insert fails inside the driver.
    const app = createApp({ db: createDb(":memory:") });

    const response = await app.request("/api/v1/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "secret-key", name: "Private name" }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      code: "internal_error",
      message: "Internal server error",
      details: {},
      requestId: response.headers.get("X-Request-Id"),
    });
    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls[0]?.[0]);
    expect(logged).toContain("no such table");
    expect(logged).not.toContain("secret-key");
    expect(logged).not.toContain("Private name");
  });
});
