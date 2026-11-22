import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlagFetch } from "./reader.ts";
import { createFlagReader } from "./reader.ts";

const DEFAULTS = { "new-checkout": false, "dark-mode": true };

type Call = { path: string; init: RequestInit };

const snapshotResponse = (version: string, flags: Record<string, boolean>) =>
  Response.json({ version, flags }, { headers: { ETag: `"${version}"` } });

/** A `fetch` double: each call takes the next queued answer and is recorded. */
function fakeFetch() {
  const calls: Call[] = [];
  const answers: Array<(init: RequestInit) => Promise<Response>> = [];
  const fetch: FlagFetch = (path, init) => {
    calls.push({ path, init });
    const answer = answers.shift();
    if (!answer) throw new Error("no answer queued");
    return answer(init);
  };
  return {
    fetch,
    calls,
    answer: (response: Response) => answers.push(() => Promise.resolve(response)),
    fail: () => answers.push(() => Promise.reject(new TypeError("network"))),
    /** An answer that arrives when `release` is called, ignoring any abort (a sloppy fetch). */
    hold: () => {
      let release: (response: Response) => void = () => {};
      answers.push(() => new Promise<Response>((resolve) => (release = resolve)));
      return (response: Response) => release(response);
    },
  };
}

function fakeDocument() {
  const target = new EventTarget();
  const document = Object.assign(target, { visibilityState: "visible" });
  return {
    document,
    setVisibility(state: "visible" | "hidden") {
      document.visibilityState = state;
      target.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

let page: ReturnType<typeof fakeDocument>;

beforeEach(() => {
  vi.useFakeTimers();
  page = fakeDocument();
  vi.stubGlobal("document", page.document);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

function setup(options: { pollMs?: number; path?: string } = {}) {
  const server = fakeFetch();
  const reader = createFlagReader({ fetch: server.fetch, defaults: DEFAULTS, ...options });
  return { server, reader };
}

describe("before the first answer", () => {
  it("answers the defaults, and false for a key with none", () => {
    const { reader } = setup();
    expect(reader.snapshot()).toBeNull();
    expect(reader.get("dark-mode")).toBe(true);
    expect(reader.get("new-checkout")).toBe(false);
    expect(reader.get("unknown")).toBe(false);
    expect(reader.get("constructor")).toBe(false);
  });

  it("fetches nothing until started", async () => {
    const { reader, server } = setup();
    await tick(60_000);
    expect(server.calls).toHaveLength(0);
    expect(reader.snapshot()).toBeNull();
  });
});

describe("reading", () => {
  it("reads at once on start, with no If-None-Match the first time", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));

    reader.start();
    await tick(0);

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]?.path).toBe("/eval/v1/flags");
    expect(server.calls[0]?.init.method).toBe("GET");
    expect(server.calls[0]?.init.headers).toEqual({ accept: "application/json" });
    expect(reader.snapshot()).toEqual({ version: "aaaa", flags: { "new-checkout": true } });
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("uses the path it is given", async () => {
    const { reader, server } = setup({ path: "/api/v1/rites/flag-manager/eval/v1/flags" });
    server.answer(snapshotResponse("aaaa", {}));
    reader.start();
    await tick(0);
    expect(server.calls[0]?.path).toBe("/api/v1/rites/flag-manager/eval/v1/flags");
    reader.stop();
  });

  it("answers the default for a key the answer lacks", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));
    reader.start();
    await tick(0);
    expect(reader.get("dark-mode")).toBe(true);
    expect(reader.get("something-else")).toBe(false);
    reader.stop();
  });

  it("polls every 5 seconds, sending the last version", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": false }));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);

    await tick(4999);
    expect(server.calls).toHaveLength(1);
    await tick(1);
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]?.init.headers).toEqual({
      accept: "application/json",
      "if-none-match": '"aaaa"',
    });
    reader.stop();
  });

  it("polls at the interval it is given", async () => {
    const { reader, server } = setup({ pollMs: 1000 });
    server.answer(snapshotResponse("aaaa", {}));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    await tick(1000);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });

  it("keeps the snapshot on a 304 and does not notify", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));
    server.answer(new Response(null, { status: 304 }));
    const listener = vi.fn();
    reader.subscribe(listener);
    reader.start();
    await tick(0);
    const first = reader.snapshot();
    expect(listener).toHaveBeenCalledTimes(1);

    await tick(5000);

    expect(server.calls).toHaveLength(2);
    expect(reader.snapshot()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
    reader.stop();
  });

  it("takes a new version, notifies, and sends it next time", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": false }));
    server.answer(snapshotResponse("bbbb", { "new-checkout": true }));
    server.answer(new Response(null, { status: 304 }));
    const listener = vi.fn();
    reader.subscribe(listener);
    reader.start();
    await tick(0);

    await tick(5000);
    expect(reader.get("new-checkout")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    await tick(5000);
    expect(server.calls[2]?.init.headers).toMatchObject({ "if-none-match": '"bbbb"' });
    reader.stop();
  });

  it("does not call a listener that unsubscribed", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    const listener = vi.fn();
    const unsubscribe = reader.subscribe(listener);
    unsubscribe();
    reader.start();
    await tick(0);
    expect(listener).not.toHaveBeenCalled();
    reader.stop();
  });

  it("start twice runs one poll", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    reader.start();
    await tick(0);
    await tick(5000);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });
});

describe("a hidden document", () => {
  it("makes no request while hidden, and reads at once when visible again", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);

    page.setVisibility("hidden");
    await tick(60_000);
    expect(server.calls).toHaveLength(1);

    page.setVisibility("visible");
    await tick(0);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });

  it("does not start reading when started hidden, until visible", async () => {
    page.document.visibilityState = "hidden";
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    reader.start();
    await tick(30_000);
    expect(server.calls).toHaveLength(0);

    page.setVisibility("visible");
    await tick(0);
    expect(server.calls).toHaveLength(1);
    reader.stop();
  });

  it("lets a request already in flight finish, then waits", async () => {
    const { reader, server } = setup();
    const release = server.hold();
    reader.start();
    await tick(0);

    page.setVisibility("hidden");
    release(snapshotResponse("aaaa", { "new-checkout": true }));
    await tick(60_000);

    expect(reader.get("new-checkout")).toBe(true);
    expect(server.calls).toHaveLength(1);
    reader.stop();
  });

  it("still reads on refresh(), which is the reader's own caller asking", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    server.answer(snapshotResponse("bbbb", { "new-checkout": true }));
    reader.start();
    await tick(0);
    page.setVisibility("hidden");

    await reader.refresh();

    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });
});

describe("errors", () => {
  it("doubles the interval on each failure, up to 60 seconds", async () => {
    const { reader, server } = setup();
    for (let i = 0; i < 7; i++) server.fail();
    reader.start();
    await tick(0);
    expect(server.calls).toHaveLength(1);

    for (const [wait, calls] of [
      [9999, 1],
      [1, 2], // after 10 s
      [20_000, 3],
      [40_000, 4],
      [60_000, 5], // capped
      [60_000, 6],
    ] as const) {
      await tick(wait);
      expect(server.calls).toHaveLength(calls);
    }
    reader.stop();
  });

  it("treats a non-2xx answer and a body that is not a snapshot as failures", async () => {
    const { reader, server } = setup();
    server.answer(new Response("busy", { status: 429 }));
    server.answer(Response.json({ version: "aaaa", flags: { "new-checkout": "yes" } }));
    server.answer(new Response("<html>", { status: 200 }));
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));
    reader.start();
    await tick(0);
    await tick(10_000); // 429 -> 10 s
    await tick(20_000); // wrong types -> 20 s
    expect(reader.snapshot()).toBeNull();
    await tick(40_000); // not JSON -> 40 s
    expect(server.calls).toHaveLength(4);
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("keeps the last good snapshot while failing, and recovers to the base interval", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));
    server.fail();
    server.answer(new Response(null, { status: 304 }));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);

    await tick(5000); // fails
    expect(reader.get("new-checkout")).toBe(true);
    expect(reader.snapshot()?.version).toBe("aaaa");

    await tick(10_000); // retries after 10 s and succeeds (304)
    expect(server.calls).toHaveLength(3);
    await tick(5000); // back at 5 s
    expect(server.calls).toHaveLength(4);
    reader.stop();
  });

  it("does not take a 304 as good before it holds a snapshot", async () => {
    const { reader, server } = setup();
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    await tick(5000);
    expect(server.calls).toHaveLength(1); // the next poll is 10 s away
    await tick(5000);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });
});

describe("refresh", () => {
  it("reads now and resolves once the answer is in", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": false }));
    server.answer(snapshotResponse("bbbb", { "new-checkout": true }));
    reader.start();
    await tick(0);

    await reader.refresh();

    expect(reader.get("new-checkout")).toBe(true);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });

  it("restarts the poll clock after the read", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    server.answer(snapshotResponse("bbbb", {}));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    await tick(3000);
    await reader.refresh();

    await tick(4999);
    expect(server.calls).toHaveLength(2);
    await tick(1);
    expect(server.calls).toHaveLength(3);
    reader.stop();
  });

  it("replaces a request in flight: the older answer is aborted and never lands", async () => {
    const { reader, server } = setup();
    const releaseOld = server.hold();
    server.answer(snapshotResponse("bbbb", { "new-checkout": true }));
    reader.start();
    await tick(0);
    const oldSignal = server.calls[0]?.init.signal;

    const done = reader.refresh();
    expect(oldSignal?.aborted).toBe(true);
    releaseOld(snapshotResponse("aaaa", { "new-checkout": false })); // a sloppy fetch answers anyway
    await done;

    expect(reader.snapshot()?.version).toBe("bbbb");
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("makes an earlier caller wait for the newer read", async () => {
    const { reader, server } = setup();
    server.hold(); // the start's read, replaced below
    const releaseSecond = server.hold();
    const releaseThird = server.hold();
    reader.start();
    await tick(0);

    let firstSettled = false;
    const first = reader.refresh().then(() => {
      firstSettled = true;
    });
    const second = reader.refresh();
    releaseSecond(snapshotResponse("aaaa", {})); // aborted by the second refresh: ignored
    await tick(0);
    expect(firstSettled).toBe(false);
    releaseThird(snapshotResponse("bbbb", { "new-checkout": true }));
    await Promise.all([first, second]);
    expect(firstSettled).toBe(true);
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("resolves when the read fails, without throwing, and keeps the snapshot", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));
    server.fail();
    reader.start();
    await tick(0);

    await expect(reader.refresh()).resolves.toBeUndefined();

    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("fetches nothing when the reader is not running", async () => {
    const { reader, server } = setup();
    await reader.refresh();
    expect(server.calls).toHaveLength(0);
  });
});

describe("stop", () => {
  it("aborts the request in flight and ignores its answer", async () => {
    const { reader, server } = setup();
    const release = server.hold();
    reader.start();
    await tick(0);

    reader.stop();
    expect(server.calls[0]?.init.signal?.aborted).toBe(true);
    release(snapshotResponse("aaaa", { "new-checkout": true }));
    await tick(0);

    expect(reader.snapshot()).toBeNull();
  });

  it("fetches nothing after it: no poll, no refresh, no visibility change", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", {}));
    reader.start();
    await tick(0);

    reader.stop();
    await tick(120_000);
    page.setVisibility("hidden");
    page.setVisibility("visible");
    await reader.refresh();
    await tick(0);

    expect(server.calls).toHaveLength(1);
  });

  it("resolves a refresh that was waiting", async () => {
    const { reader, server } = setup();
    server.hold();
    reader.start();
    await tick(0);
    const done = reader.refresh();
    reader.stop();
    await expect(done).resolves.toBeUndefined();
  });

  it("can start again, keeping the snapshot it had", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse("aaaa", { "new-checkout": true }));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    reader.stop();

    reader.start();
    await tick(0);

    expect(server.calls[1]?.init.headers).toMatchObject({ "if-none-match": '"aaaa"' });
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });
});
