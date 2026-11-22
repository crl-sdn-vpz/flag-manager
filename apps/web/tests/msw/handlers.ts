import type { Flag, FlagList, HealthResponse } from "api-client";
import type { FlagSnapshot } from "flags-sdk";
import { HttpResponse, http } from "msw";

export const sampleFlags: Flag[] = [
  {
    key: "dark-mode",
    name: "Dark mode",
    description: "Offer a dark colour scheme.",
    enabled: true,
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
  },
  {
    key: "new-checkout",
    name: "New checkout",
    description: "",
    enabled: false,
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
  },
];

/** Default happy-path handlers. Override per test with server.use(...). */
export const handlers = [
  http.get("*/api/v1/health", () =>
    HttpResponse.json<HealthResponse>({ status: "ok", version: "0.1.0", database: "ok" }),
  ),
  http.get("*/api/v1/flags", () => HttpResponse.json<FlagList>({ items: sampleFlags })),
  http.get("*/eval/v1/flags", () =>
    HttpResponse.json<FlagSnapshot>({
      version: "0000000000000000",
      flags: Object.fromEntries(sampleFlags.map((flag) => [flag.key, flag.enabled])),
    }),
  ),
];
