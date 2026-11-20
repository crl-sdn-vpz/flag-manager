import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { listFlagsQueryKey } from "api-client/query";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { server } from "../../../../tests/msw/server";
import { FlagList } from "./flag-list";

function renderList() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <FlagList announce={() => undefined} />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("FlagList", () => {
  it("keeps showing loaded flags when a refresh fails, with a retry", async () => {
    const queryClient = renderList();
    await screen.findByRole("switch", { name: "Dark mode" });
    server.use(http.get("*/api/v1/flags", () => HttpResponse.error()));

    void queryClient.invalidateQueries({ queryKey: listFlagsQueryKey() });

    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(alert).toHaveTextContent("Couldn't refresh flags");
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeInTheDocument();

    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await expect.poll(() => screen.queryByRole("alert")).toBeNull();
  });

  it("shows a blocking error with retry when the first load fails", async () => {
    server.use(http.get("*/api/v1/flags", () => HttpResponse.error()));
    renderList();

    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(alert).toHaveTextContent("Couldn't load flags");
    expect(screen.queryByRole("list", { name: "Flags" })).toBeNull();
  });
});
