import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ErrorResponse, FlagList } from "api-client";
import { delay, HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { sampleFlags } from "../../../../tests/msw/handlers";
import { server } from "../../../../tests/msw/server";
import { FlagsPage } from "./flags-page";

function renderPage() {
  // The app's real client, so tests exercise the settings that ship (e.g. networkMode).
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <FlagsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("FlagsPage toggle", () => {
  it("moves the switch at once, rolls it back on failure and offers retry", async () => {
    server.use(
      http.patch("*/api/v1/flags/:key", async () => {
        await delay(50);
        return HttpResponse.json<ErrorResponse>(
          {
            code: "internal_error",
            message: "Internal server error",
            details: {},
            requestId: "r1",
          },
          { status: 500 },
        );
      }),
    );
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "New checkout" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    // Optimistic: on immediately, and busy while the request is in flight.
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveAttribute("aria-disabled", "true");

    const row = toggle.closest("li");
    if (!row) throw new Error("switch is not inside a list item");
    expect(await within(row).findByText("Couldn't turn on New checkout.")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(within(row).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't turn on New checkout.");
  });

  it("fails and rolls back at once when the browser is offline, instead of queueing", async () => {
    server.use(http.patch("*/api/v1/flags/:key", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "New checkout" });
    onlineManager.setOnline(false);

    await user.click(toggle);

    const row = toggle.closest("li");
    if (!row) throw new Error("switch is not inside a list item");
    expect(await within(row).findByText("Couldn't turn on New checkout.")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("keeps keyboard focus when Retry is pressed", async () => {
    server.use(http.patch("*/api/v1/flags/:key", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "New checkout" });
    await user.click(toggle);
    const retry = await screen.findByRole("button", { name: "Retry" });

    retry.focus();
    await user.keyboard("{Enter}");

    expect(toggle).toHaveFocus();
  });

  it("re-reads the list after a failure, so the switch matches the server", async () => {
    // The change reached the server but the response was lost (e.g. a proxy 502).
    let serverEnabled = false;
    server.use(
      http.patch("*/api/v1/flags/:key", () => {
        serverEnabled = true;
        return new HttpResponse(null, { status: 502 });
      }),
      http.get("*/api/v1/flags", () =>
        HttpResponse.json<FlagList>({
          items: sampleFlags.map((flag) =>
            flag.key === "new-checkout" ? { ...flag, enabled: serverEnabled } : flag,
          ),
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "New checkout" });

    await user.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(toggle).not.toHaveAttribute("aria-disabled");
  });

  it("announces a repeated failure again by replacing the live region's content", async () => {
    server.use(http.patch("*/api/v1/flags/:key", () => HttpResponse.error()));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("switch", { name: "New checkout" }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Couldn't turn on New checkout."));
    const first = status.firstElementChild;

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => expect(status.firstElementChild).not.toBe(first));
    expect(status).toHaveTextContent("Couldn't turn on New checkout.");
  });
});
