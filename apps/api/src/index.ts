import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { env } from "./core/env.ts";
import { logger } from "./core/logger.ts";
import { createDb } from "./db/client.ts";

const app = createApp({ db: createDb(env.DATABASE_URL) });

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "api listening");
});
