import { describe, expect, it } from "vitest";
import { PREVIEW_FLAGS } from "./preview-flags.ts";

describe("PREVIEW_FLAGS", () => {
  it("is the five sample keys, all off", () => {
    expect(PREVIEW_FLAGS).toEqual({
      "beta-search": false,
      "ai-summaries": false,
      "new-checkout": false,
      "dark-mode": false,
      "legacy-export": false,
    });
  });

  it("cannot be changed by a reader's caller", () => {
    expect(Object.isFrozen(PREVIEW_FLAGS)).toBe(true);
  });
});
