import { beforeEach, describe, expect, it } from "vitest";
import { type App, createApp } from "../app.ts";
import type { ErrorBody } from "../core/errors.ts";
import { createDb } from "../db/client.ts";
import { applyMigrations } from "../db/migrate.ts";
import type { FlagSnapshot } from "../schemas/eval.ts";
import { createEvalRoutes } from "./eval.ts";

const PATH = "/eval/v1/flags";
const EMPTY_VERSION = "e3b0c44298fc1c14"; // sha256 of the empty string, first 16 hex

let app: App;

async function newApp(): Promise<App> {
  const db = createDb(":memory:");
  await applyMigrations(db);
  return createApp({ db });
}

beforeEach(async () => {
  app = await newApp();
});

const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const create = (target: App, key: string) =>
  target.request("/api/v1/flags", json("POST", { key, name: key }));
const setEnabled = (target: App, key: string, enabled: boolean) =>
  target.request(`/api/v1/flags/${key}`, json("PATCH", { enabled }));
const read = async (target: App = app) => {
  const response = await target.request(PATH);
  return { response, body: (await response.json()) as FlagSnapshot };
};

describe("GET /eval/v1/flags", () => {
  it("answers 200 with the version and every flag's state", async () => {
    await create(app, "new-checkout");
    await create(app, "beta-search");
    await setEnabled(app, "new-checkout", true);

    const { response, body } = await read();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(body).toEqual({
      version: expect.stringMatching(/^[0-9a-f]{16}$/),
      flags: { "beta-search": false, "new-checkout": true },
    });
  });

  it("answers with an empty set, and a version, when there are no flags", async () => {
    const { response, body } = await read();

    expect(response.status).toBe(200);
    expect(body).toEqual({ version: EMPTY_VERSION, flags: {} });
  });

  it("sends the version as the ETag, and asks caches to revalidate", async () => {
    await create(app, "new-checkout");

    const { response, body } = await read();

    expect(response.headers.get("ETag")).toBe(`"${body.version}"`);
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("answers 304 with no body when If-None-Match matches", async () => {
    await create(app, "new-checkout");
    const { body } = await read();

    const response = await app.request(PATH, { headers: { "If-None-Match": `"${body.version}"` } });

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
    expect(response.headers.get("ETag")).toBe(`"${body.version}"`);
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it.each([
    ["a weak tag", (etag: string) => `W/${etag}`],
    ["a list", (etag: string) => `"0000000000000000", ${etag}`],
    ["a wildcard", () => "*"],
  ])("answers 304 for %s that includes the current version", async (_name, header) => {
    const { body } = await read();

    const response = await app.request(PATH, {
      headers: { "If-None-Match": header(`"${body.version}"`) },
    });

    expect(response.status).toBe(304);
  });

  it("answers 200 with the new state when the tag is stale", async () => {
    await create(app, "new-checkout");
    const before = (await read()).body;
    await setEnabled(app, "new-checkout", true);

    const response = await app.request(PATH, {
      headers: { "If-None-Match": `"${before.version}"` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as FlagSnapshot;
    expect(body.flags).toEqual({ "new-checkout": true });
    expect(response.headers.get("ETag")).toBe(`"${body.version}"`);
    expect(body.version).not.toBe(before.version);
  });

  it("answers 200 for a tag that is not a version", async () => {
    const response = await app.request(PATH, { headers: { "If-None-Match": "garbage" } });

    expect(response.status).toBe(200);
  });

  it("only reads: other methods are not routed", async () => {
    const response = await app.request(PATH, { method: "POST" });

    expect(response.status).toBe(404);
    expect(((await response.json()) as ErrorBody).code).toBe("not_found");
  });

  it("returns the error envelope with a request id on an unexpected error", async () => {
    // No migrations: the flags table is missing.
    const broken = createApp({ db: createDb(":memory:") });

    const response = await broken.request(PATH);

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      code: "internal_error",
      requestId: response.headers.get("X-Request-Id"),
    });
  });
});

describe("the version", () => {
  it("is the same for the same flags, in any order of creation, and across restarts", async () => {
    const other = await newApp();
    await create(app, "alpha-flag");
    await create(app, "beta-flag");
    await create(other, "beta-flag");
    await create(other, "alpha-flag");

    expect((await read(app)).body.version).toBe((await read(other)).body.version);
  });

  it("is a fixed function of the sorted `key=0|1` lines", async () => {
    // "new-checkout=1" sorts before "new=0" ("-" is before "="): the lines are sorted, not the keys.
    await create(app, "new");
    await create(app, "new-checkout");
    await setEnabled(app, "new-checkout", true);

    expect((await read()).body.version).toBe("8971cc6002fc24be");
  });

  it("does not change when a read or a no-op write happens", async () => {
    await create(app, "new-checkout");
    const first = (await read()).body.version;

    await setEnabled(app, "new-checkout", false);

    expect((await read()).body.version).toBe(first);
  });

  it("changes after a toggle, and again when it is toggled back", async () => {
    await create(app, "new-checkout");
    const off = (await read()).body.version;

    await setEnabled(app, "new-checkout", true);
    const on = (await read()).body.version;
    await setEnabled(app, "new-checkout", false);
    const offAgain = (await read()).body.version;

    expect(on).not.toBe(off);
    // The version follows the states, not the history: the same answer has the same version.
    expect(offAgain).toBe(off);
  });

  it("changes after a create", async () => {
    await create(app, "new-checkout");
    const before = (await read()).body.version;

    await create(app, "beta-search");

    expect((await read()).body.version).not.toBe(before);
  });
});

describe("the two OpenAPI documents", () => {
  const info = { openapi: "3.1.0", info: { title: "t", version: "0" } } as const;

  it("keep the evaluation route out of the admin document", () => {
    const admin = app.getOpenAPI31Document(info);

    expect(Object.keys(admin.paths ?? {}).filter((path) => path.includes("eval"))).toEqual([]);
    expect(admin.components?.schemas).not.toHaveProperty("FlagSnapshot");
  });

  it("give the evaluation document only the evaluation route", () => {
    const evaluation = createEvalRoutes().getOpenAPI31Document(info);

    expect(Object.keys(evaluation.paths ?? {})).toEqual([PATH]);
  });
});
