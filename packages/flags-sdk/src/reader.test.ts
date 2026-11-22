import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlagFetch } from "./reader.ts";
import { createFlagReader } from "./reader.ts";

const DEFAULTS = { "new-checkout": false, "dark-mode": true };
const AAAA = "aaaaaaaaaaaaaaaa";
const BBBB = "bbbbbbbbbbbbbbbb";

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
  const reads: boolean[] = [];
  const reader = createFlagReader({
    fetch: server.fetch,
    defaults: DEFAULTS,
    onRead: (ok) => reads.push(ok),
    ...options,
  });
  return { server, reader, reads };
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
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));

    reader.start();
    await tick(0);

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]?.path).toBe("/eval/v1/flags");
    expect(server.calls[0]?.init.method).toBe("GET");
    expect(server.calls[0]?.init.headers).toEqual({ accept: "application/json" });
    expect(reader.snapshot()).toEqual({ version: AAAA, flags: { "new-checkout": true } });
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("uses the path it is given", async () => {
    const { reader, server } = setup({ path: "/api/v1/rites/flag-manager/eval/v1/flags" });
    server.answer(snapshotResponse(AAAA, {}));
    reader.start();
    await tick(0);
    expect(server.calls[0]?.path).toBe("/api/v1/rites/flag-manager/eval/v1/flags");
    reader.stop();
  });

  it("answers the default for a key the answer lacks", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
    reader.start();
    await tick(0);
    expect(reader.get("dark-mode")).toBe(true);
    expect(reader.get("something-else")).toBe(false);
    reader.stop();
  });

  it("polls every 5 seconds, sending the last version", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, { "new-checkout": false }));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);

    await tick(4999);
    expect(server.calls).toHaveLength(1);
    await tick(1);
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1]?.init.headers).toEqual({
      accept: "application/json",
      "if-none-match": `"${AAAA}"`,
    });
    reader.stop();
  });

  it("polls at the interval it is given", async () => {
    const { reader, server } = setup({ pollMs: 1000 });
    server.answer(snapshotResponse(AAAA, {}));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    await tick(1000);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });

  it("keeps the snapshot on a 304 and does not notify", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
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
    server.answer(snapshotResponse(AAAA, { "new-checkout": false }));
    server.answer(snapshotResponse(BBBB, { "new-checkout": true }));
    server.answer(new Response(null, { status: 304 }));
    const listener = vi.fn();
    reader.subscribe(listener);
    reader.start();
    await tick(0);

    await tick(5000);
    expect(reader.get("new-checkout")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    await tick(5000);
    expect(server.calls[2]?.init.headers).toMatchObject({ "if-none-match": `"${BBBB}"` });
    reader.stop();
  });

  it("does not call a listener that unsubscribed", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, {}));
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
    server.answer(snapshotResponse(AAAA, {}));
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
    server.answer(snapshotResponse(AAAA, {}));
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
    server.answer(snapshotResponse(AAAA, {}));
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
    release(snapshotResponse(AAAA, { "new-checkout": true }));
    await tick(60_000);

    expect(reader.get("new-checkout")).toBe(true);
    expect(server.calls).toHaveLength(1);
    reader.stop();
  });

  it("still reads on refresh(), which is the reader's own caller asking", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, {}));
    server.answer(snapshotResponse(BBBB, { "new-checkout": true }));
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
    server.answer(Response.json({ version: AAAA, flags: { "new-checkout": "yes" } }));
    server.answer(new Response("<html>", { status: 200 }));
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
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
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
    server.fail();
    server.answer(new Response(null, { status: 304 }));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);

    await tick(5000); // fails
    expect(reader.get("new-checkout")).toBe(true);
    expect(reader.snapshot()?.version).toBe(AAAA);

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
    server.answer(snapshotResponse(AAAA, { "new-checkout": false }));
    server.answer(snapshotResponse(BBBB, { "new-checkout": true }));
    reader.start();
    await tick(0);

    await reader.refresh();

    expect(reader.get("new-checkout")).toBe(true);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });

  it("restarts the poll clock after the read", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, {}));
    server.answer(snapshotResponse(BBBB, {}));
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
    server.answer(snapshotResponse(BBBB, { "new-checkout": true }));
    reader.start();
    await tick(0);
    const oldSignal = server.calls[0]?.init.signal;

    const done = reader.refresh();
    expect(oldSignal?.aborted).toBe(true);
    releaseOld(snapshotResponse(AAAA, { "new-checkout": false })); // a sloppy fetch answers anyway
    await done;

    expect(reader.snapshot()?.version).toBe(BBBB);
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
    releaseSecond(snapshotResponse(AAAA, {})); // aborted by the second refresh: ignored
    await tick(0);
    expect(firstSettled).toBe(false);
    releaseThird(snapshotResponse(BBBB, { "new-checkout": true }));
    await Promise.all([first, second]);
    expect(firstSettled).toBe(true);
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });

  it("resolves when the read fails, without throwing, and keeps the snapshot", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
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
    release(snapshotResponse(AAAA, { "new-checkout": true }));
    await tick(0);

    expect(reader.snapshot()).toBeNull();
  });

  it("fetches nothing after it: no poll, no refresh, no visibility change", async () => {
    const { reader, server } = setup();
    server.answer(snapshotResponse(AAAA, {}));
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
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    reader.stop();

    reader.start();
    await tick(0);

    expect(server.calls[1]?.init.headers).toMatchObject({ "if-none-match": `"${AAAA}"` });
    expect(reader.get("new-checkout")).toBe(true);
    reader.stop();
  });
});

describe("a read that gets no answer", () => {
  it("is aborted after 10 seconds and counted as a failure, then the poll recovers", async () => {
    const { reader, server, reads } = setup();
    server.hold(); // never answers, and ignores the abort
    server.answer(snapshotResponse(AAAA, { "new-checkout": true }));
    reader.start();
    await tick(0);
    const signal = server.calls[0]?.init.signal;

    await tick(9999);
    expect(signal?.aborted).toBe(false);
    await tick(1);
    expect(signal?.aborted).toBe(true);
    expect(reads).toEqual([false]);

    // Backed off like any failure: 10 s, not 5 s.
    await tick(9999);
    expect(server.calls).toHaveLength(1);
    await tick(1);
    expect(server.calls).toHaveLength(2);
    expect(reader.get("new-checkout")).toBe(true);
    expect(reads).toEqual([false, true]);
    reader.stop();
  });

  it("ignores an answer that arrives after the timeout", async () => {
    const { reader, server } = setup();
    const release = server.hold();
    reader.start();
    await tick(10_000);

    release(snapshotResponse(AAAA, { "new-checkout": true }));
    await tick(0);

    expect(reader.snapshot()).toBeNull();
    reader.stop();
  });

  it("waits longer than 10 seconds when pollMs is longer", async () => {
    const { reader, server } = setup({ pollMs: 30_000 });
    server.hold();
    reader.start();
    await tick(29_999);
    expect(server.calls[0]?.init.signal?.aborted).toBe(false);
    await tick(1);
    expect(server.calls[0]?.init.signal?.aborted).toBe(true);
    reader.stop();
  });

  it("does not time out a read that was answered, or one that stop() ended", async () => {
    const { reader, server, reads } = setup();
    server.answer(snapshotResponse(AAAA, {}));
    server.hold();
    reader.start();
    await tick(5000); // the second read starts
    reader.stop();
    await tick(60_000);
    expect(reads).toEqual([true]);
  });
});

describe("onRead", () => {
  it("says true for a snapshot and for a 304, false for each kind of failure", async () => {
    const { reader, server, reads } = setup();
    server.answer(snapshotResponse(AAAA, {}));
    server.answer(new Response(null, { status: 304 }));
    server.fail();
    server.answer(new Response("oops", { status: 500 }));
    reader.start();
    await tick(0);
    await tick(5000);
    await tick(5000);
    await tick(10_000);
    expect(reads).toEqual([true, true, false, false]);
    reader.stop();
  });

  it("treats a 200 that is not a snapshot as failed, so a caller can say so", async () => {
    const { reader, server, reads } = setup();
    server.answer(new Response("<!doctype html><html></html>", { status: 200 }));
    server.answer(Response.json({ some: "other document" }));
    reader.start();
    await tick(0);
    await tick(10_000);
    expect(reads).toEqual([false, false]);
    expect(reader.snapshot()).toBeNull();
    reader.stop();
  });

  it("is not called for a read that refresh() replaced or stop() aborted", async () => {
    const { reader, server, reads } = setup();
    server.hold();
    server.hold();
    reader.start();
    await tick(0);
    void reader.refresh();
    await tick(0);
    reader.stop();
    await tick(60_000);
    expect(reads).toEqual([]);
  });
});

describe("Retry-After", () => {
  it("sets the floor of the next interval on a 429 or a 503", async () => {
    const { reader, server } = setup();
    server.answer(new Response("slow down", { status: 429, headers: { "Retry-After": "30" } }));
    server.answer(new Response("down", { status: 503, headers: { "Retry-After": "90" } }));
    server.answer(snapshotResponse(AAAA, {}));
    reader.start();
    await tick(0);

    // 30 s, not the 10 s a plain failure would back off to.
    await tick(29_999);
    expect(server.calls).toHaveLength(1);
    await tick(1);
    expect(server.calls).toHaveLength(2);

    // The 503 asks for 90 s; the cap is 60 s.
    await tick(59_999);
    expect(server.calls).toHaveLength(2);
    await tick(1);
    expect(server.calls).toHaveLength(3);
    reader.stop();
  });

  it("never goes below the doubled interval, and is capped at 60 seconds", async () => {
    const { reader, server } = setup();
    server.answer(new Response("", { status: 429, headers: { "Retry-After": "1" } }));
    server.answer(new Response("", { status: 429, headers: { "Retry-After": "600" } }));
    server.answer(snapshotResponse(AAAA, {}));
    reader.start();
    await tick(0);
    await tick(10_000); // 1 s is below the doubled 10 s
    expect(server.calls).toHaveLength(2);
    await tick(59_999);
    expect(server.calls).toHaveLength(2);
    await tick(1);
    expect(server.calls).toHaveLength(3);
    reader.stop();
  });

  it("ignores a value that is not whole seconds, and the header on other statuses", async () => {
    const { reader, server } = setup();
    server.answer(
      new Response("", {
        status: 429,
        headers: { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" },
      }),
    );
    server.answer(new Response("", { status: 500, headers: { "Retry-After": "50" } }));
    server.answer(snapshotResponse(AAAA, {}));
    reader.start();
    await tick(0);
    await tick(10_000);
    expect(server.calls).toHaveLength(2);
    await tick(20_000);
    expect(server.calls).toHaveLength(3);
    reader.stop();
  });
});

describe("a visibility change while backed off", () => {
  it("does not read at once; the poll resumes at the longer interval", async () => {
    const { reader, server } = setup();
    server.fail();
    server.answer(snapshotResponse(AAAA, {}));
    reader.start();
    await tick(0);
    expect(server.calls).toHaveLength(1);

    page.setVisibility("hidden");
    page.setVisibility("visible");
    await tick(9999);
    expect(server.calls).toHaveLength(1);
    await tick(1);
    expect(server.calls).toHaveLength(2);
    reader.stop();
  });

  it("reads at once again after a good read ended the backoff", async () => {
    const { reader, server } = setup();
    server.fail();
    server.answer(snapshotResponse(AAAA, {}));
    server.answer(new Response(null, { status: 304 }));
    reader.start();
    await tick(0);
    await tick(10_000);

    page.setVisibility("hidden");
    page.setVisibility("visible");
    await tick(0);

    expect(server.calls).toHaveLength(3);
    reader.stop();
  });
});

describe("a snapshot's version", () => {
  it.each([
    ["too short", "abc"],
    ["too long", "a".repeat(17)],
    ["upper case", "AAAAAAAAAAAAAAAA"],
    ["not hex", "gggggggggggggggg"],
  ])("rejects a version that is %s", async (_name, version) => {
    const { reader, server, reads } = setup();
    server.answer(Response.json({ version, flags: { "new-checkout": true } }));
    reader.start();
    await tick(0);
    expect(reader.snapshot()).toBeNull();
    expect(reads).toEqual([false]);
    reader.stop();
  });
});
