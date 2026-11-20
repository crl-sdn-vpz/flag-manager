import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CreateFlagRequest, Flag } from "api-client";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/app/query-client";
import { server } from "../../../../tests/msw/server";
import { FlagsPage } from "./flags-page";

describe("CreateFlagForm", () => {
  it("confirms a create visibly and can take the user to the new flag", async () => {
    server.use(
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
      }),
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <FlagsPage />
      </QueryClientProvider>,
    );
    await screen.findByRole("switch", { name: "Dark mode" });

    await user.type(screen.getByLabelText("Key"), "beta-search");
    await user.type(screen.getByLabelText("Name"), "Beta search");
    await user.click(screen.getByRole("button", { name: "Create flag" }));

    const form = screen.getByRole("form", { name: "New flag" });
    expect(await within(form).findByText(/created\. It is off\./)).toBeVisible();
    expect(screen.getByLabelText("Key")).toHaveFocus();
    expect(screen.getByLabelText("Key")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Show flag" }));

    expect(screen.getByRole("switch", { name: "Beta search" })).toHaveFocus();
  });
});
