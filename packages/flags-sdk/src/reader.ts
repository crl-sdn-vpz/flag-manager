/**
 * A reader for the evaluation route (`GET /eval/v1/flags`, see ./../openapi.json).
 *
 * No dependencies and no framework: it takes any `fetch`-shaped function, so a browser's
 * `window.fetch`, a host's proxied `ctx.api` or a test double all work. It polls, keeps the last
 * good snapshot, and answers `get(key)` with a default until the first answer arrives.
 */

export type FlagSnapshot = { version: string; flags: Readonly<Record<string, boolean>> };

/** The shape of `window.fetch` and of a playground host's `ctx.api`. */
export type FlagFetch = (path: string, init: RequestInit) => Promise<Response>;

export type FlagReader = {
  /** The flag's state: the last answer's, or its default for a key the answer lacks. */
  get(key: string): boolean;
  /** The last good answer, or null before the first one. */
  snapshot(): FlagSnapshot | null;
  /** Called whenever the snapshot changes (not on a 304). Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /**
   * Reads now, replacing any request in flight (an older answer must not land after a newer
   * write). Resolves when the read has settled and never rejects: a failure keeps the last
   * snapshot and backs the poll off. Resolves at once, without a request, unless the reader runs.
   */
  refresh(): Promise<void>;
  /** Reads now, then every `pollMs` while the document is visible. Safe to call again after stop(). */
  start(): void;
  /** Aborts the request in flight, cancels the poll and fetches nothing until start() again. */
  stop(): void;
};

export type FlagReaderOptions = {
  fetch: FlagFetch;
  /** Default "/eval/v1/flags". */
  path?: string;
  /** What `get` answers for a key before the first answer, and for a key the answer lacks. */
  defaults: Readonly<Record<string, boolean>>;
  /** Poll interval in ms. Default 5000. Doubles on errors, up to MAX_BACKOFF_MS. */
  pollMs?: number;
};

const DEFAULT_PATH = "/eval/v1/flags";
const DEFAULT_POLL_MS = 5000;
const MAX_BACKOFF_MS = 60_000;

/** Parse the 200 body; null when it is not a snapshot (a proxy's HTML page, a changed contract). */
function parseSnapshot(body: unknown): FlagSnapshot | null {
  if (typeof body !== "object" || body === null) return null;
  const { version, flags } = body as { version?: unknown; flags?: unknown };
  if (typeof version !== "string" || typeof flags !== "object" || flags === null) return null;
  const states: Record<string, boolean> = {};
  for (const [key, state] of Object.entries(flags)) {
    if (typeof state !== "boolean") return null;
    states[key] = state;
  }
  return { version, flags: Object.freeze(states) };
}

function documentHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState !== "visible";
}

type InFlight = { controller: AbortController; done: Promise<void> };

export function createFlagReader(options: FlagReaderOptions): FlagReader {
  const { fetch: doFetch, path = DEFAULT_PATH, defaults, pollMs = DEFAULT_POLL_MS } = options;

  let current: FlagSnapshot | null = null;
  let running = false;
  let interval = pollMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: InFlight | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  /** The next poll, unless the document is hidden: becoming visible reads at once instead. */
  const schedule = () => {
    clearTimer();
    if (!running || documentHidden()) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!documentHidden()) void load();
    }, interval);
  };

  /** Resolves true when the answer is usable (200 with a snapshot, or 304 for the one we hold). */
  async function read(signal: AbortSignal): Promise<boolean> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (current) headers["if-none-match"] = `"${current.version}"`;
    const response = await doFetch(path, { method: "GET", headers, signal });
    if (signal.aborted) return false;
    if (response.status === 304) return current !== null;
    if (!response.ok) return false;
    const next = parseSnapshot(await response.json());
    if (signal.aborted || next === null) return false;
    if (current?.version !== next.version) {
      current = next;
      notify();
    }
    return true;
  }

  async function request(entry: InFlight): Promise<void> {
    let ok = false;
    try {
      ok = await read(entry.controller.signal);
    } catch {
      // A rejected fetch or a body that is not JSON: the same as any other failed read.
    }
    if (entry.controller.signal.aborted) {
      // Replaced by a newer read (wait for it) or stopped (nothing to wait for).
      await inflight?.done;
      return;
    }
    interval = ok ? pollMs : Math.min(interval * 2, MAX_BACKOFF_MS);
    inflight = null;
    schedule();
  }

  function load(): Promise<void> {
    if (!running) return Promise.resolve();
    clearTimer();
    inflight?.controller.abort();
    const entry: InFlight = { controller: new AbortController(), done: Promise.resolve() };
    inflight = entry;
    entry.done = request(entry);
    return entry.done;
  }

  const onVisibilityChange = () => {
    if (!running) return;
    if (documentHidden()) clearTimer();
    else if (!inflight) void load();
  };

  return {
    get(key) {
      if (current && Object.hasOwn(current.flags, key)) return current.flags[key] === true;
      return Object.hasOwn(defaults, key) && defaults[key] === true;
    },
    snapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh: load,
    start() {
      if (running) return;
      running = true;
      interval = pollMs;
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      if (!documentHidden()) void load();
    },
    stop() {
      if (!running) return;
      running = false;
      clearTimer();
      inflight?.controller.abort();
      inflight = null;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    },
  };
}
