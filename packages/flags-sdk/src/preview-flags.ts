/**
 * The five sample flags the shop preview reads, each off: "the shop as it was". A flag created
 * by hand is not one of them and is never read. Pass this as `defaults` to `createFlagReader`.
 */
export const PREVIEW_FLAGS: Readonly<Record<string, boolean>> = Object.freeze({
  "beta-search": false,
  "ai-summaries": false,
  "new-checkout": false,
  "dark-mode": false,
  "legacy-export": false,
});
