// Prints an OpenAPI document to stdout without starting a server (used by `just gen-client`).
//   node src/openapi.ts          the admin API (packages/api-client)
//   node src/openapi.ts eval     the read-only evaluation API (packages/flags-sdk)
import { createApp } from "./app.ts";
import { createEvalRoutes } from "./routes/eval.ts";

const documents = {
  admin: () =>
    createApp({} as Parameters<typeof createApp>[0]).getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "API", version: "0.1.0" },
    }),
  eval: () =>
    createEvalRoutes().getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "Flag evaluation API",
        version: "0.1.0",
        description:
          "Read-only. What a service calls to learn which flags are on; the admin API is a separate document.",
      },
    }),
};

const name = process.argv[2] ?? "admin";
if (name !== "admin" && name !== "eval") {
  console.error(`Unknown document "${name}". Available: ${Object.keys(documents).join(", ")}`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(documents[name](), null, 2)}\n`);
