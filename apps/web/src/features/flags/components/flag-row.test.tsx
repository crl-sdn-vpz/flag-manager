import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { Flag, FlagList } from "api-client";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { server } from "../../../../tests/msw/server";
import { FlagList as FlagListView } from "./flag-list";

const flag = (key: string): Flag => ({
  key,
  name: key,
  description: "",
  enabled: false,
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
});

describe("FlagRow's preview hint", () => {
  it("names the region each of the five sample flags drives, and no other row has one", async () => {
    const keys = [
      "ai-summaries",
      "beta-search",
      "dark-mode",
      "legacy-export",
      "new-checkout",
      "my-flag",
    ];
    server.use(
      http.get("*/api/v1/flags", () => HttpResponse.json<FlagList>({ items: keys.map(flag) })),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <FlagListView announce={() => undefined} />
      </QueryClientProvider>,
    );
    await screen.findByRole("switch", { name: "my-flag" });

    const hint = (key: string) => {
      const row = document.getElementById(`flag-${key}`);
      if (!row) throw new Error(`no row for ${key}`);
      return within(row).queryByText(/read by the preview/);
    };
    expect(hint("beta-search")).toHaveTextContent(/· read by the preview: search$/);
    expect(hint("ai-summaries")).toHaveTextContent(/· read by the preview: order note$/);
    expect(hint("new-checkout")).toHaveTextContent(/· read by the preview: checkout$/);
    expect(hint("dark-mode")).toHaveTextContent(/· read by the preview: settings$/);
    expect(hint("legacy-export")).toHaveTextContent(/· read by the preview: export$/);
    expect(hint("my-flag")).toBeNull();
  });
});
