import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../tests/msw/server";
import { HealthStatus } from "./health-status";

function renderWithQuery() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

describe("HealthStatus", () => {
  it("shows the API status once loaded", async () => {
    renderWithQuery();

    expect(screen.getByRole("status")).toHaveTextContent("Checking API");
    const health = await screen.findByLabelText("API health");
    expect(health).toHaveTextContent("APIok");
    expect(health).toHaveTextContent("Databaseok");
  });

  it("shows an error when the API is unreachable", async () => {
    server.use(http.get("*/api/v1/health", () => HttpResponse.error()));
    renderWithQuery();

    expect(await screen.findByRole("alert")).toHaveTextContent("API unreachable");
  });
});
