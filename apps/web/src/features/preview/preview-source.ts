import type { FlagFetch, FlagReader, FlagSnapshot } from "flags-sdk";
import { createFlagReader, PREVIEW_FLAGS } from "flags-sdk";
import { REGIONS, type Region, type RegionId, regionForKey } from "./regions";

export type PreviewState = {
  /** The last answer; null before the first one (the shop is drawn as it was). */
  snapshot: FlagSnapshot | null;
  /** The newest read failed. With no snapshot yet it is the first read; otherwise a refresh. */
  failed: boolean;
  /** The regions that differ in the newest snapshot that changed any of them; none on first load. */
  changed: readonly RegionId[];
};

export type PreviewSource = {
  getState(): PreviewState;
  subscribe(listener: () => void): () => void;
  start(): void;
  stop(): void;
  /** The `retry` after a failed read. */
  retry(): Promise<void>;
  /**
   * After the reviewer's own successful switch: reads at once, and returns the sentence to add to
   * the switch's announcement, or null when the preview does not read the flag, the read failed or
   * is slow, or the preview does not show the new state. Never rejects.
   */
  afterOwnFlip(key: string, enabled: boolean): Promise<string | null>;
};

/** How long the switch's own announcement waits for the preview before it is said alone. */
const ANNOUNCE_WAIT_MS = 2500;

const isOn = (snapshot: FlagSnapshot | null, key: string) => snapshot?.flags[key] === true;

/** The regions whose flag differs between two snapshots. */
function changedRegions(before: FlagSnapshot, after: FlagSnapshot): RegionId[] {
  return REGIONS.filter((region) => isOn(before, region.key) !== isOn(after, region.key)).map(
    (region) => region.id,
  );
}

export function createPreviewSource(fetchFlags: FlagFetch): PreviewSource {
  let state: PreviewState = { snapshot: null, failed: false, changed: [] };
  const listeners = new Set<() => void>();

  const update = (patch: Partial<PreviewState>) => {
    const next = { ...state, ...patch };
    if (next.snapshot === state.snapshot && next.failed === state.failed && !patch.changed) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };

  // What the pane says about a failed read comes from the reader, which has parsed the body: a
  // 200 that is not a snapshot (an SPA fallback page) is a failure too.
  const reader: FlagReader = createFlagReader({
    fetch: fetchFlags,
    defaults: PREVIEW_FLAGS,
    onRead: (ok) => update({ failed: !ok }),
  });

  reader.subscribe(() => {
    const before = state.snapshot;
    const after = reader.snapshot();
    if (!after) return;
    const changed = before ? changedRegions(before, after) : [];
    update(changed.length > 0 ? { snapshot: after, changed } : { snapshot: after });
  });

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => reader.start(),
    stop: () => reader.stop(),
    retry: () => reader.refresh(),
    async afterOwnFlip(key, enabled) {
      const region: Region | undefined = regionForKey(key);
      if (!region) return null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const tooSlow = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ANNOUNCE_WAIT_MS);
      });
      await Promise.race([reader.refresh(), tooSlow]);
      clearTimeout(timer);
      const shown = !state.failed && state.snapshot !== null && reader.get(key) === enabled;
      return shown ? region.announcement(enabled) : null;
    },
  };
}
