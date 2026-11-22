import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Flag, FlagList } from "api-client";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { HomePage } from "@/app/routes/home-page";
import { server } from "../../../tests/msw/server";

const SAMPLE_KEYS = ["beta-search", "ai-summaries", "new-checkout", "dark-mode", "legacy-export"];

/** A tiny in-memory backend: the admin list, the toggle and the evaluation route over one state. */
function useBackend(initial: Record<string, boolean> = {}) {
  const enabled: Record<string, boolean> = Object.fromEntries(SAMPLE_KEYS.map((k) => [k, false]));
  Object.assign(enabled, initial);
  let version = 1;
  const evalRequests: Array<string | null> = [];
  const state = { evalMode: "ok" as "ok" | "fail" };

  const flag = (key: string): Flag => ({
    key,
    name: key,
    description: "",
    enabled: enabled[key] === true,
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
  });

  server.use(
    http.get("*/api/v1/flags", () =>
      HttpResponse.json<FlagList>({ items: Object.keys(enabled).sort().map(flag) }),
    ),
    http.patch("*/api/v1/flags/:key", async ({ request, params }) => {
      const body = (await request.json()) as { enabled: boolean };
      enabled[String(params.key)] = body.enabled;
      version += 1;
      return HttpResponse.json<Flag>(flag(String(params.key)));
    }),
    http.get("*/eval/v1/flags", ({ request }) => {
      const sent = request.headers.get("if-none-match");
      evalRequests.push(sent);
      if (state.evalMode === "fail") return HttpResponse.error();
      const etag = `"v${version}"`;
      if (sent === etag) return new HttpResponse(null, { status: 304, headers: { ETag: etag } });
      return HttpResponse.json(
        { version: `v${version}`, flags: { ...enabled } },
        { headers: { ETag: etag } },
      );
    }),
  );

  return {
    evalRequests,
    state,
    /** Another reviewer's flip: it changes the server only. */
    flipElsewhere(key: string, on: boolean) {
      enabled[key] = on;
      version += 1;
    },
  };
}

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
  document.dispatchEvent(new Event("visibilitychange"));
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <HomePage />
    </QueryClientProvider>,
  );
}

const pane = () => screen.getByRole("region", { name: "Preview" });
/** A region's heading by its words, "label state[ · changed]"; whitespace in the name is ignored. */
const region = (words: RegExp) =>
  within(pane()).getByRole("heading", {
    level: 3,
    name: (name) => words.test(name.replace(/\s+/g, " ").trim()),
  });
const liveRegion = () => screen.getAllByRole("status").find((node) => node.className === "sr-only");

beforeEach(() => {
  vi.stubGlobal("matchMedia", undefined);
});

afterEach(() => {
  setVisibility("visible");
  vi.unstubAllGlobals();
});

describe("the preview before and after the first answer", () => {
  it("draws the shop as it was while reading, with a status", async () => {
    useBackend();
    server.use(http.get("*/eval/v1/flags", () => new Promise(() => {})));
    renderPage();

    expect(within(pane()).getByRole("status")).toHaveTextContent("Reading the flags…");
    expect(
      within(pane()).getByRole("heading", { level: 2, name: "~/preview" }),
    ).toBeInTheDocument();
    expect(within(pane()).getByText("reads 5 flags")).toBeInTheDocument();
    expect(region(/^search ranked by name$/)).toBeInTheDocument();
    expect(region(/^order note no summary$/)).toBeInTheDocument();
    expect(region(/^checkout three steps$/)).toBeInTheDocument();
    expect(region(/^settings no colour scheme$/)).toBeInTheDocument();
    expect(region(/^export csv link removed$/)).toBeInTheDocument();
    expect(within(pane()).getByText("Moth & Ink")).toBeInTheDocument();
  });

  it("shows the note and the flags' states once read, marking nothing on first load", async () => {
    useBackend({ "new-checkout": true, "legacy-export": true });
    renderPage();

    expect(
      await within(pane()).findByText("It only reads: nothing in it can be pressed."),
    ).toBeVisible();
    expect(region(/^checkout one page$/)).toBeInTheDocument();
    expect(region(/^export csv link kept$/)).toBeInTheDocument();
    expect(within(pane()).getByText("[ pay now ]")).toBeInTheDocument();
    expect(within(pane()).getByText("[ export csv ]")).toBeInTheDocument();
    expect(within(pane()).queryByText(/changed/)).toBeNull();
    expect(within(pane()).queryByRole("status")).toBeNull();
  });

  it("has nothing to press: no button, link or field in the pane", async () => {
    useBackend({ "beta-search": true, "dark-mode": true, "ai-summaries": true });
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    expect(within(pane()).queryAllByRole("button")).toHaveLength(0);
    expect(within(pane()).queryAllByRole("link")).toHaveLength(0);
    expect(within(pane()).queryAllByRole("textbox")).toHaveLength(0);
  });

  it("draws each region's on and off states as text", async () => {
    useBackend({ "beta-search": true, "ai-summaries": true, "dark-mode": true });
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    const items = within(pane())
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items.slice(0, 3)).toEqual([
      "Quill, raven, shed$9",
      "Quill, goose, ordinary$4",
      "Quill pen, enchanted (needs a nap)$24",
    ]);
    expect(within(pane()).getByText("summary, generated")).toBeInTheDocument();
    expect(
      within(pane()).getByText(
        "Wrap quills apart from wax; leave the parcel with the raven until Tuesday.",
      ),
    ).toBeInTheDocument();
    expect(items).toContain("colour schemelight · dark");
  });

  it("says so when the first read fails, and retry reads again", async () => {
    const backend = useBackend({ "new-checkout": true });
    backend.state.evalMode = "fail";
    const user = userEvent.setup();
    renderPage();

    expect(
      await within(pane()).findByText("Couldn't read the flags. Showing the shop as it was."),
    ).toBeInTheDocument();
    expect(region(/^checkout three steps$/)).toBeInTheDocument();
    expect(within(pane()).getAllByRole("button")).toHaveLength(1);

    backend.state.evalMode = "ok";
    await user.click(within(pane()).getByRole("button", { name: "retry" }));

    expect(
      await within(pane()).findByRole("heading", { name: /^checkout one page$/ }),
    ).toBeInTheDocument();
    expect(within(pane()).queryByText(/Couldn't read/)).toBeNull();
  });
});

describe("after the reviewer's own flip", () => {
  it("reads at once, marks the region and adds the preview's sentence to the switch's own", async () => {
    const backend = useBackend();
    const user = userEvent.setup();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");
    expect(backend.evalRequests).toHaveLength(1);

    await user.click(await screen.findByRole("switch", { name: "new-checkout" }));

    await waitFor(() => expect(region(/^checkout one page · changed$/)).toBeInTheDocument());
    expect(region(/^search ranked by name$/)).toBeInTheDocument();
    await waitFor(() =>
      expect(liveRegion()).toHaveTextContent(
        "new-checkout turned on. Preview: checkout is now one page.",
      ),
    );
    // Read once after the flip, with the version it already held.
    expect(backend.evalRequests).toEqual([null, '"v1"']);
  });

  it("moves the mark when another flag flips, and says the other way too", async () => {
    useBackend({ "new-checkout": true, "legacy-export": true });
    const user = userEvent.setup();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    await user.click(await screen.findByRole("switch", { name: "legacy-export" }));
    await waitFor(() => expect(region(/^export csv link removed · changed$/)).toBeInTheDocument());
    await waitFor(() =>
      expect(liveRegion()).toHaveTextContent(
        "legacy-export turned off. Preview: the csv export link is gone.",
      ),
    );

    await user.click(screen.getByRole("switch", { name: "new-checkout" }));
    await waitFor(() => expect(region(/^checkout three steps · changed$/)).toBeInTheDocument());
    expect(region(/^export csv link removed$/)).toBeInTheDocument();
    await waitFor(() =>
      expect(liveRegion()).toHaveTextContent(
        "new-checkout turned off. Preview: checkout is now three steps.",
      ),
    );
  });

  it("says only the switch's own sentence when the refresh fails", async () => {
    const backend = useBackend();
    const user = userEvent.setup();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");
    backend.state.evalMode = "fail";

    await user.click(await screen.findByRole("switch", { name: "beta-search" }));

    await waitFor(() => expect(liveRegion()).toHaveTextContent("beta-search turned on."));
    expect(liveRegion()).not.toHaveTextContent("Preview:");
    expect(
      await within(pane()).findByText("Couldn't refresh the preview. It may be out of date."),
    ).toBeInTheDocument();
    // The last good drawing stays.
    expect(region(/^search ranked by name$/)).toBeInTheDocument();
  });

  it("clears the refresh error when a read works", async () => {
    const backend = useBackend();
    const user = userEvent.setup();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");
    backend.state.evalMode = "fail";
    await user.click(await screen.findByRole("switch", { name: "beta-search" }));
    await within(pane()).findByText("Couldn't refresh the preview. It may be out of date.");

    backend.state.evalMode = "ok";
    await user.click(screen.getByRole("switch", { name: "dark-mode" }));

    await waitFor(() => expect(within(pane()).queryByText(/Couldn't refresh/)).toBeNull());
    expect(region(/^search ranked by best match/)).toBeInTheDocument();
    expect(region(/^settings colour scheme offered/)).toBeInTheDocument();
  });

  it("does not read for a flag the preview does not drive", async () => {
    const backend = useBackend({ "my-flag": false });
    const user = userEvent.setup();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    await user.click(await screen.findByRole("switch", { name: "my-flag" }));

    await waitFor(() => expect(liveRegion()).toHaveTextContent("my-flag turned on."));
    expect(backend.evalRequests).toHaveLength(1);
  });
});

describe("another reviewer's flip", () => {
  it("is drawn at the next read, marked, and never announced", async () => {
    const backend = useBackend();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    backend.flipElsewhere("ai-summaries", true);
    setVisibility("hidden");
    setVisibility("visible"); // a tab coming back reads at once, as a poll would

    await waitFor(() => expect(region(/^order note summary shown · changed$/)).toBeInTheDocument());
    expect(liveRegion()).toHaveTextContent("");
  });

  it("keeps the mark when a later read changes only a flag the preview ignores", async () => {
    const backend = useBackend({ "my-flag": false });
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");
    backend.flipElsewhere("ai-summaries", true);
    setVisibility("hidden");
    setVisibility("visible");
    await waitFor(() => expect(region(/^order note summary shown · changed$/)).toBeInTheDocument());

    backend.flipElsewhere("my-flag", true);
    setVisibility("hidden");
    setVisibility("visible");
    await waitFor(() => expect(backend.evalRequests).toHaveLength(3));

    expect(region(/^order note summary shown · changed$/)).toBeInTheDocument();
  });
});

describe("the reader's lifetime", () => {
  it("stops reading when the page unmounts", async () => {
    const backend = useBackend();
    const view = renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    view.unmount();
    setVisibility("hidden");
    setVisibility("visible");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(backend.evalRequests).toHaveLength(1);
  });
});

describe("see the preview", () => {
  it("jumps to the pane and focuses its heading, changing nothing in the live region", async () => {
    useBackend();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const user = userEvent.setup();
    renderPage();
    await within(pane()).findByText("It only reads: nothing in it can be pressed.");

    await user.click(screen.getByRole("button", { name: "see the preview" }));

    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(scroll.mock.contexts[0]).toBe(pane());
    expect(within(pane()).getByRole("heading", { level: 2, name: "~/preview" })).toHaveFocus();
    expect(liveRegion()).toHaveTextContent("");
  });

  it("jumps instantly with reduced motion", async () => {
    useBackend();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "see the preview" }));

    expect(scroll).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
  });

  it("works from the keyboard", async () => {
    useBackend();
    const user = userEvent.setup();
    renderPage();
    const button = await screen.findByRole("button", { name: "see the preview" });
    button.focus();

    await user.keyboard("{Enter}");

    expect(within(pane()).getByRole("heading", { name: "~/preview" })).toHaveFocus();
  });
});
