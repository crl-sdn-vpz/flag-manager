import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { configureApiClient } from "@/lib/api";
import { server } from "./msw/server";

configureApiClient("http://localhost");

// jsdom has no layout, so no scrollIntoView; the app calls it on user-initiated navigation.
Element.prototype.scrollIntoView = () => {};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
