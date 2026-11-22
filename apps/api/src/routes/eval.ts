import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../app.ts";
import { ErrorResponseSchema } from "../schemas/errors.ts";
import {
  EvalRequestHeadersSchema,
  EvalResponseHeadersSchema,
  FlagSnapshotSchema,
} from "../schemas/eval.ts";
import { getFlagSnapshot } from "../services/eval.ts";

const getFlagsRoute = createRoute({
  method: "get",
  path: "/eval/v1/flags",
  operationId: "evaluate_flags",
  tags: ["evaluation"],
  request: { headers: EvalRequestHeadersSchema },
  responses: {
    200: {
      description: "The state of every flag",
      headers: EvalResponseHeadersSchema,
      content: { "application/json": { schema: FlagSnapshotSchema } },
    },
    304: {
      description: "The caller's snapshot is current (If-None-Match matched). No body.",
      headers: EvalResponseHeadersSchema,
    },
    500: {
      description: "Unexpected error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

/**
 * The read path, apart from the admin API: its own router and its own OpenAPI document
 * (`just gen-client` writes it to packages/flags-sdk/openapi.json). It only reads.
 */
export function createEvalRoutes(): OpenAPIHono<AppEnv> {
  const app = new OpenAPIHono<AppEnv>();

  app.openapi(getFlagsRoute, async (c) => {
    const { db } = c.get("deps");
    const snapshot = await getFlagSnapshot(db);
    const etag = `"${snapshot.version}"`;

    // Readers keep what they have and revalidate on every poll: no-cache, not max-age.
    c.header("Cache-Control", "no-cache");
    c.header("ETag", etag);
    if (matchesETag(c.req.header("If-None-Match"), etag)) return c.body(null, 304);
    return c.json(snapshot, 200);
  });

  return app;
}

/** True when If-None-Match is `*` or lists this ETag (a proxy may have weakened it to W/"..."). */
function matchesETag(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((candidate) => {
    const value = candidate.trim();
    return value === "*" || value.replace(/^W\//, "") === etag;
  });
}
