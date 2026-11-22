import { PREVIEW_FLAGS } from "flags-sdk";

/**
 * The five regions of the shop, each driven by one sample flag. This file is the preview's
 * copy: the pane, the list's row hints and the live-region sentences all read from it.
 */
export type RegionId = "search" | "order note" | "checkout" | "settings" | "export";

export type Region = {
  /** The region's own name: its label in the pane and in the list's "read by the preview" hint. */
  id: RegionId;
  /** The flag that drives it; one of `PREVIEW_FLAGS`. */
  key: string;
  /** The state in words, so the drawing is never the only sign. */
  state: (on: boolean) => string;
  /** The sentence added to the switch's own announcement once the preview shows the new state. */
  announcement: (on: boolean) => string;
};

/** In the order they are drawn, top to bottom. */
export const REGIONS: readonly Region[] = [
  {
    id: "search",
    key: "beta-search",
    state: (on) => (on ? "ranked by best match" : "ranked by name"),
    announcement: (on) =>
      `Preview: search is now ${on ? "ranked by best match" : "ranked by name"}.`,
  },
  {
    id: "order note",
    key: "ai-summaries",
    state: (on) => (on ? "summary shown" : "no summary"),
    announcement: (on) =>
      on
        ? "Preview: long order notes now show a summary."
        : "Preview: long order notes no longer show a summary.",
  },
  {
    id: "checkout",
    key: "new-checkout",
    state: (on) => (on ? "one page" : "three steps"),
    announcement: (on) => `Preview: checkout is now ${on ? "one page" : "three steps"}.`,
  },
  {
    id: "settings",
    key: "dark-mode",
    state: (on) => (on ? "colour scheme offered" : "no colour scheme"),
    announcement: (on) =>
      on
        ? "Preview: settings now offer a colour scheme."
        : "Preview: settings no longer offer a colour scheme.",
  },
  {
    id: "export",
    key: "legacy-export",
    state: (on) => (on ? "csv link kept" : "csv link removed"),
    announcement: (on) =>
      on ? "Preview: the csv export link is back." : "Preview: the csv export link is gone.",
  },
];

// The reader's defaults and the regions must name the same five flags.
if (REGIONS.some((region) => !(region.key in PREVIEW_FLAGS))) {
  throw new Error("A preview region reads a flag that PREVIEW_FLAGS does not list");
}

/** The region a flag drives, or undefined for a flag the preview does not read. */
export function regionForKey(key: string): Region | undefined {
  return REGIONS.find((region) => region.key === key);
}
