import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { env } from "./core/env.ts";
import { logger } from "./core/logger.ts";
import { createDb, ensureDatabaseDir } from "./db/client.ts";
import { applyMigrations } from "./db/migrate.ts";
import { seedIfEmpty } from "./db/seed.ts";

// First run needs no manual step: create the database, bring it up to date, add sample flags.
ensureDatabaseDir(env.DATABASE_URL);
const db = createDb(env.DATABASE_URL);
await applyMigrations(db);
await seedIfEmpty(db);

const app = createApp({ db });

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info({ port: info.port }, "api listening");
});
