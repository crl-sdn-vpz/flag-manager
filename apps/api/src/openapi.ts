// Prints the OpenAPI document to stdout without starting a server (used by `just gen-client`).
import { createApp } from "./app.ts";

const app = createApp({} as Parameters<typeof createApp>[0]);
const document = app.getOpenAPI31Document({
  openapi: "3.1.0",
  info: { title: "API", version: "0.1.0" },
});
process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
