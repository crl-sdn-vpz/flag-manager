import { defineConfig } from "@hey-api/openapi-ts";

// OPENAPI_INPUT / OPENAPI_OUTPUT let `just check-client` generate into a temp dir and diff.
export default defineConfig({
  input: process.env.OPENAPI_INPUT ?? "./openapi.json",
  output: process.env.OPENAPI_OUTPUT ?? "./src/generated",
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/typescript",
    "@hey-api/sdk",
    "@tanstack/react-query",
  ],
});
