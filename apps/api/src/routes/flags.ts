import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../app.ts";
import { ErrorResponseSchema } from "../schemas/errors.ts";
import {
  CreateFlagRequestSchema,
  FlagKeyParamSchema,
  FlagListSchema,
  FlagSchema,
  SetFlagEnabledRequestSchema,
} from "../schemas/flags.ts";
import { createFlag, listFlags, setFlagEnabled } from "../services/flags.ts";

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponseSchema } },
});

// Answered before validation, by the JSON body parser, for every route that takes a body.
const bodyErrorResponses = {
  400: errorResponse("The request body is not valid JSON (code http_error)"),
  415: errorResponse("The request's Content-Type is not application/json (code http_error)"),
};

const listFlagsRoute = createRoute({
  method: "get",
  path: "/flags",
  operationId: "list_flags",
  tags: ["flags"],
  responses: {
    200: {
      description: "All flags, ordered by key",
      content: { "application/json": { schema: FlagListSchema } },
    },
    500: errorResponse("Unexpected error"),
  },
});

const createFlagRoute = createRoute({
  method: "post",
  path: "/flags",
  operationId: "create_flag",
  tags: ["flags"],
  request: {
    body: { required: true, content: { "application/json": { schema: CreateFlagRequestSchema } } },
  },
  responses: {
    201: {
      description: "The created flag (always disabled)",
      content: { "application/json": { schema: FlagSchema } },
    },
    ...bodyErrorResponses,
    409: errorResponse("A flag with this key already exists (code flag_key_conflict)"),
    422: errorResponse("Request validation failed (code validation_error)"),
    500: errorResponse("Unexpected error"),
  },
});

const setFlagEnabledRoute = createRoute({
  method: "patch",
  path: "/flags/{key}",
  operationId: "set_flag_enabled",
  tags: ["flags"],
  request: {
    params: FlagKeyParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: SetFlagEnabledRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "The flag in its requested state. Idempotent: repeating gives the same result.",
      content: { "application/json": { schema: FlagSchema } },
    },
    ...bodyErrorResponses,
    404: errorResponse("No flag with this key (code flag_not_found)"),
    422: errorResponse("Request validation failed (code validation_error)"),
    500: errorResponse("Unexpected error"),
  },
});

export function registerFlagRoutes(app: OpenAPIHono<AppEnv>): void {
  app.openapi(listFlagsRoute, async (c) => {
    const { db } = c.get("deps");
    return c.json(await listFlags(db), 200);
  });

  app.openapi(createFlagRoute, async (c) => {
    const { db } = c.get("deps");
    const flag = await createFlag(db, c.req.valid("json"), { requestId: c.get("requestId") });
    return c.json(flag, 201);
  });

  app.openapi(setFlagEnabledRoute, async (c) => {
    const { db } = c.get("deps");
    const { key } = c.req.valid("param");
    const { enabled } = c.req.valid("json");
    const flag = await setFlagEnabled(db, key, enabled, { requestId: c.get("requestId") });
    return c.json(flag, 200);
  });
}
