import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CreateFlagRequest, ErrorResponse, Flag, FlagList } from "api-client";
import { listFlagsQueryKey } from "api-client/query";
import { delay, HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { sampleFlags } from "../../../../tests/msw/handlers";
import { server } from "../../../../tests/msw/server";
import { FlagsPage } from "./flags-page";

const createdFlagHandler = () =>
  http.post("*/api/v1/flags", async ({ request }) => {
    const body = (await request.json()) as CreateFlagRequest;
    return HttpResponse.json<Flag>(
      {
        key: body.key,
        name: body.name,
        description: body.description ?? "",
        enabled: false,
        createdAt: "2026-11-20T10:00:00.000Z",
        updatedAt: "2026-11-20T10:00:00.000Z",
      },
      { status: 201 },
    );
  });

function renderPage() {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <FlagsPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

async function createBetaSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Key"), "beta-search");
  await user.type(screen.getByLabelText("Name"), "Beta search");
  await user.click(screen.getByRole("button", { name: "Create flag" }));
}

describe("CreateFlagForm", () => {
  it("confirms a create visibly and can take the user to the new flag", async () => {
    server.use(createdFlagHandler());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("switch", { name: "Dark mode" });

    await createBetaSearch(user);

    const form = screen.getByRole("form", { name: "New flag" });
    expect(await within(form).findByText(/created\. It is off\./)).toBeVisible();
    expect(screen.getByLabelText("Key")).toHaveFocus();
    expect(screen.getByLabelText("Key")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Show flag" }));

    expect(screen.getByRole("switch", { name: "Beta search" })).toHaveFocus();
  });

  it("keeps the new flag when an older list fetch finishes after the create", async () => {
    const user = userEvent.setup();
    const queryClient = renderPage();
    await screen.findByRole("switch", { name: "Dark mode" });
    // A slow refetch that started before the create, so its response lacks the new flag.
    server.use(
      createdFlagHandler(),
      http.get("*/api/v1/flags", async () => {
        await delay(100);
        return HttpResponse.json<FlagList>({ items: sampleFlags });
      }),
    );
    void queryClient.invalidateQueries({ queryKey: listFlagsQueryKey() });

    await createBetaSearch(user);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(screen.getByRole("switch", { name: "Beta search" })).toBeInTheDocument();
  });

  it("puts a server validation error on its field and moves focus there", async () => {
    server.use(
      http.post("*/api/v1/flags", () =>
        HttpResponse.json<ErrorResponse>(
          {
            code: "validation_error",
            message: "Request validation failed",
            details: { issues: [{ path: ["name"], message: "Name is reserved" }] },
            requestId: "r1",
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("switch", { name: "Dark mode" });

    await createBetaSearch(user);

    const name = screen.getByLabelText("Name");
    expect(await screen.findByText("Name is reserved")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();
  });
});
