import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type App, createApp } from "../app.ts";
import { createDb } from "../db/client.ts";
import { applyMigrations } from "../db/migrate.ts";

const T0 = new Date("2026-11-20T10:00:00.000Z");
const T1 = new Date("2026-11-20T10:05:00.000Z");

let app: App;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  const db = createDb(":memory:");
  await applyMigrations(db);
  app = createApp({ db });
});

afterEach(() => {
  vi.useRealTimers();
});

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const create = (body: unknown) => app.request("/api/v1/flags", json("POST", body));
const setEnabled = (key: string, body: unknown) =>
  app.request(`/api/v1/flags/${key}`, json("PATCH", body));

const darkMode = { key: "dark-mode", name: "Dark mode", description: "Dark theme for the app" };

/** Every error body carries the request ID that is also in the response header. */
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body).toMatchObject({ code, requestId: response.headers.get("X-Request-Id") });
  expect(body.requestId).toBeTruthy();
  return body;
}

describe("GET /api/v1/flags", () => {
  it("lists flags ordered by key", async () => {
    await create({ key: "zeta-flag", name: "Zeta" });
    await create({ key: "alpha-flag", name: "Alpha" });

    const response = await app.request("/api/v1/flags");

    expect(response.status).toBe(200);
    const { items } = await response.json();
    expect(items.map((flag: { key: string }) => flag.key)).toEqual(["alpha-flag", "zeta-flag"]);
  });
});

describe("POST /api/v1/flags", () => {
  it("creates a disabled flag with server-set UTC timestamps", async () => {
    const response = await create({ ...darkMode, name: "  Dark mode  " });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ...darkMode,
      enabled: false,
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
  });

  it("stores a missing description as an empty string", async () => {
    const response = await create({ key: "beta-search", name: "Beta search" });

    expect(await response.json()).toMatchObject({ description: "" });
  });

  it.each([
    ["too short", "a"],
    ["too long", `a${"b".repeat(64)}`],
    ["uppercase", "Dark-mode"],
    ["starts with a digit", "1dark"],
    ["starts with a hyphen", "-dark"],
    ["trailing hyphen", "dark-"],
    ["double hyphen", "dark--mode"],
    ["underscore", "dark_mode"],
    ["space", "dark mode"],
  ])("rejects a key that is %s", async (_rule, key) => {
    const body = await expectError(await create({ ...darkMode, key }), 422, "validation_error");
    expect(body.details.issues[0].path).toEqual(["key"]);
  });

  it("accepts keys at the length limits", async () => {
    expect((await create({ ...darkMode, key: "ab" })).status).toBe(201);
    expect((await create({ ...darkMode, key: `a${"b".repeat(63)}` })).status).toBe(201);
  });

  it("rejects unknown fields", async () => {
    await expectError(await create({ ...darkMode, enabled: true }), 422, "validation_error");
  });

  it("rejects a blank name", async () => {
    await expectError(await create({ ...darkMode, name: "   " }), 422, "validation_error");
  });

  it("returns 409 flag_key_conflict for a duplicate key", async () => {
    await create(darkMode);

    await expectError(await create(darkMode), 409, "flag_key_conflict");
  });

  it("lets only one of two simultaneous creates with the same key succeed", async () => {
    const responses = await Promise.all([create(darkMode), create(darkMode)]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe("PATCH /api/v1/flags/:key", () => {
  it("sets the state and bumps updatedAt", async () => {
    await create(darkMode);
    vi.setSystemTime(T1);

    const response = await setEnabled("dark-mode", { enabled: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      enabled: true,
      createdAt: T0.toISOString(),
      updatedAt: T1.toISOString(),
    });
  });

  it("is idempotent: repeating the request returns the same body", async () => {
    await create(darkMode);
    vi.setSystemTime(T1);
    const first = await (await setEnabled("dark-mode", { enabled: true })).json();
    vi.setSystemTime(new Date("2026-11-20T11:00:00.000Z"));

    const second = await setEnabled("dark-mode", { enabled: true });

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(first);
  });

  it("returns 404 flag_not_found for a missing key", async () => {
    await expectError(await setEnabled("missing", { enabled: true }), 404, "flag_not_found");
  });

  it("rejects a non-boolean or extra field", async () => {
    await create(darkMode);

    await expectError(await setEnabled("dark-mode", { enabled: "yes" }), 422, "validation_error");
    await expectError(
      await setEnabled("dark-mode", { enabled: true, name: "x" }),
      422,
      "validation_error",
    );
  });
});
