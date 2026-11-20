import type { HealthResponse } from "api-client";
import { HttpResponse, http } from "msw";

/** Default happy-path handlers. Override per test with server.use(...). */
export const handlers = [
  http.get("*/api/v1/health", () =>
    HttpResponse.json<HealthResponse>({ status: "ok", version: "0.1.0", database: "ok" }),
  ),
];
