import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ErrorResponse } from "api-client";
import { delay, HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../tests/msw/server";
import { FlagsPage } from "./flags-page";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlagsPage />
    </QueryClientProvider>,
  );
}

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
});
