# flag-manager

A small feature flag manager: one page to see every flag, turn it on or off, and create new ones.
It is a React app on top of a Hono API with SQLite, built as the first iteration of something a team would keep extending.

![The flag manager page: the "New flag" form above the list of flags, each with an On/Off switch](docs/screenshot.png)

## How to run

Prerequisites: **Node 24** and **pnpm**. `corepack enable` provides the pinned pnpm version. The Node 24 install must be the one on your `PATH`: if your shell defaults to another Node (for example through nvm), the commands below fail with `pnpm: not found`.

```bash
pnpm bootstrap   # creates .env from .env.example, installs dependencies, applies migrations, generates the API client
pnpm dev         # API on http://localhost:8000, web on http://localhost:5173 (Ctrl+C stops both)
pnpm test        # API tests, then web tests
pnpm check       # everything CI runs: format, lint, types, tests, API client freshness
```

Open http://localhost:5173. On first start the API creates the SQLite file (`apps/api/data/app.db`), applies the migrations and adds five sample flags. To start over, stop `pnpm dev`, delete that file and start again.

Other tasks: `pnpm gen-client` regenerates the API client after a route or schema change, and `pnpm db:migrate` applies migrations by hand. The same tasks exist as [just](https://just.systems) recipes (`just setup`, `just dev`, `just test`, `just check`); run `just` to list them.

## What's in it

```
apps/api/                  Hono API (Node 24 runs the TypeScript directly)
  src/routes/              HTTP only: OpenAPI route definitions and thin handlers
  src/schemas/             Zod request and response schemas; also the source of the OpenAPI document
  src/services/            Rules: new flags start off, PATCH sets a state, domain event logs
  src/db/                  Drizzle schema, flag repository, startup migrate and seed
  src/core/                env, logger, error envelope, request log
  drizzle/                 SQL migrations
apps/web/                  React app (Vite, TanStack Query, Tailwind)
  src/features/flags/      the page: list, row with switch, create form, data hooks
  src/components/ui/       Button and Switch
  src/index.css            theme tokens: every colour, space and font as a CSS variable
packages/api-client/       TypeScript client and TanStack Query hooks generated from the OpenAPI document
docs/adr/                  architecture decisions
```

The path of a request, for example turning a flag on:

1. **Web:** the switch moves at once. `features/flags/api.ts` calls the generated `setFlagEnabled` hook from `packages/api-client`. Vite proxies `/api` to the API.
2. **Middleware** (`app.ts`): assigns the request ID, then writes one request-log line when the response leaves.
3. **Route** (`routes/flags.ts`): Zod validates the path and body. A failure returns 422 before any logic runs.
4. **Service** (`services/flags.ts`): applies the rules, throws domain errors, and logs a `flag.state_changed` event.
5. **Repository** (`db/flag-repository.ts`): Drizzle runs one `UPDATE … WHERE enabled <> ? RETURNING` against SQLite.
6. **Errors:** anything thrown becomes the error envelope in `app.onError`. On failure the web app rolls the switch back and offers Retry.

The web app never declares API types by hand. The API's Zod schemas produce the OpenAPI document, the client is generated from it, and `pnpm check` fails if the generated client is stale.

## API reference

Base path `/api/v1`. JSON in and out. Every response carries an `X-Request-Id` header: a well-formed incoming one (up to 255 characters of letters, digits, `_`, `-`, `=`) is reused, and anything else is replaced with a new UUID. The full contract is in `packages/api-client/openapi.json`.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/flags` | | 200 `{ "items": Flag[] }`, ordered by key | |
| POST | `/flags` | `{ key, name, description? }` | 201 the created flag, always `enabled: false` | 422 `validation_error`, 409 `flag_key_conflict` |
| PATCH | `/flags/{key}` | `{ "enabled": boolean }` | 200 the flag | 422 `validation_error`, 404 `flag_not_found` |

A flag:

```json
{
  "key": "new-checkout",
  "name": "New checkout",
  "description": "Single-page checkout with saved payment methods.",
  "enabled": false,
  "createdAt": "2026-11-20T10:00:00.000Z",
  "updatedAt": "2026-11-20T10:00:00.000Z"
}
```

Field rules:

- `key`: 2–64 characters of lowercase letters, digits and hyphens. It starts with a letter and has no trailing or double hyphen. It is unique (enforced by the database) and can't be changed.
- `name`: trimmed, 1–80 characters.
- `description`: optional and trimmed, at most 280 characters. A missing description is stored as `""`.
- Timestamps are set by the server, in UTC, with one-second precision.
- Unknown fields in a request body are rejected.

`PATCH` sets a state; it does not flip one. Repeating a request returns the same flag. When the flag is already in the requested state, nothing is written, no event is logged and `updatedAt` stays the same, so retries and double clicks are safe.

Every error has the same shape:

```json
{
  "code": "flag_key_conflict",
  "message": "A flag with key \"dark-mode\" already exists",
  "details": { "key": "dark-mode" },
  "requestId": "3f6c2a9e-8f0b-4d7e-9a51-2c1e4b7d9f00"
}
```

| Status | `code` | When |
|---|---|---|
| 422 | `validation_error` | The body or a field breaks a rule. `details.issues` lists each problem with its `path` (for example `["key"]`) and `message`. |
| 409 | `flag_key_conflict` | The key already exists. |
| 404 | `flag_not_found` | No flag has that key. |
| 404 | `not_found` | Unknown route. |
| 400 | `http_error` | The body is not valid JSON. |
| 415 | `http_error` | The request has a body but no `Content-Type: application/json` header. |
| 500 | `internal_error` | Anything unexpected. No stack traces or SQL are returned. The `requestId` matches the server's log lines. |

`requestId` is in the body as well as the header because people report errors by pasting the body. [ADR 0002](docs/adr/0002-request-id-in-error-body.md) explains the decision.

## Assumptions

- Flags are global: each flag has one state, with no per-environment values.
- The key is the flag's identity. It is fixed at creation and never needs renaming.
- One API instance and one SQLite file are enough at this scale.
- Other services don't read flags from this API yet. This is the management side only.
- Times are stored in UTC and shown in the browser's local time zone.

## Tradeoffs chosen on purpose

- **`PATCH` sets a state instead of a `/toggle` action.** A toggle is shorter to call, but repeating it flips the flag back. Setting `{ "enabled": true }` gives the same result however many times it arrives, so retries and double clicks are safe.
- **Setting a flag to its current state does nothing.** No write, no event, and `updatedAt` stays the same. "Last updated" stays truthful and the event log only records real changes. The repeat still appears in the request log, so it isn't invisible.
- **The list is wrapped in `{ "items": [] }`, not returned as a bare array.** It is slightly more verbose, but pagination or totals can be added later without breaking clients.
- **The key is the primary key, with no separate numeric id.** Uniqueness is enforced by the database, so two simultaneous creates can't both succeed, and the 409 comes from that constraint rather than from a check-then-insert in code. The cost is that renaming a key would need a migration, and rename is out of scope.
- **Requests fail immediately when the browser is offline.** By default TanStack Query pauses requests while offline and sends them once the connection returns. For a flag manager, a change landing minutes later without warning is worse than a visible failure. The switch rolls back and offers Retry instead. A manual check found this.
- **The request ID is in every error body as well as the header.** This departs from the template's three-field error shape. People report errors by pasting the body, and the ID links it to the server's log lines. See [ADR 0002](docs/adr/0002-request-id-in-error-body.md).
- **There is no confirmation dialog on toggle.** A dialog on every change trains people to click through it, and undo doesn't help because a flag change takes effect the moment it's saved. Real protection needs environments, a reason for each change and approvals, which belong to a later stage (see below).
- **The database seeds five sample flags on first start.** A fresh clone shows something realistic with no manual step. The cost is that the "no flags yet" state only appears in tests or with an empty database file.
- **Each API test gets its own in-memory database instead of rolling back a transaction.** The template's convention is rollback, but the SQLite client fails while a transaction is open on its single in-memory connection. A fresh database per test gives the same isolation.

## What was left out, and why

- **Authentication and roles.** The brief excludes them. Without users, there is no one to authorize. The event log already has an `actor` field (currently `anonymous`), so adding auth later doesn't change the log format.
- **Environments (dev, staging, production).** They change the data model (a flag's state becomes per environment) and every screen. They are the first thing to add next (see below).
- **An evaluation API or SDK for client services.** This is a different product with different needs: read-heavy, cached, low latency. It shouldn't be bolted onto an admin API in the first iteration.
- **Audit log, change history and approvals.** They need auth to mean anything. The structured `flag.state_changed` events are the starting point for an audit table.
- **Safeguards on flipping a switch (confirmation, a required reason, approval by someone else).** They depend on the three items above.
- **Targeting rules, percentage rollouts, experiments; delete, archive, rename; pagination and sorting; Docker, deployment and e2e tests.** These are out of scope for a time-boxed first iteration that should be easy to read and easy to extend, rather than broad.

## With another day

1. Edit a flag's description from the list.
2. Return 422 `validation_error` for malformed JSON and a missing `Content-Type`, so every input error has one shape. These are 400 and 415 `http_error` today.
3. Quieter test output: the API tests print every log line, which makes a real failure harder to spot.
4. Briefly highlight a newly created row, as well as the "created" message and "Show flag".
5. After a toggle fails but the server applied it anyway (a lost response), clear the row's error message once the re-read list shows the requested state.

## How it would grow in a larger platform

- **Environments with protection scaled to risk.** One click in development, a confirmation and a required reason in production, and approval by a second person for critical flags.
- **Auth, roles and an audit table.** The audit table would be filled from the domain events the service already logs, with `actor` filled in by auth.
- **Postgres instead of SQLite** once there is more than one API instance. The repository interface keeps that change in one place.
- **Distributed tracing** built on the request ID that already ties error bodies to log lines.

## Time and process

**Scaffold.** The repository was generated from my own template (v0.1.2), part of a personal hub of project templates, coding rules and agent skills (plan, implement, add endpoint, add UI feature, migrate the database, self-review, verify the UI in a browser). The scaffold, the plain-pnpm scripts and the removal of a git-hook dependency happened before the timed build. The hub makes starting a project fast. The cost is up front: the plans, specs and guardrails that drive it have to be written and kept current.

**Time.** The build on top of the scaffold took about **1 hour 40 minutes** against a 60-minute target. The overrun has three causes:

- **Supervision by design.** Every slice (API, UI, finish) stopped for my review and approval before the next one began. I made decisions explicitly as they came up, for example what happens when a flag is set to its current state, and where focus goes after a create.
- **Environment issues:**
  - the shell resolved an older Node without pnpm, which broke the tasks and the git hooks;
  - the linter rejected Tailwind v4's `@theme` syntax until enabled in its config;
  - the browser automation couldn't start Chrome as root under WSL, so the first UI check was done by hand.
- **Bugs found and fixed:**
  - my manual check found that toggles hung while offline;
  - an automated review found that Retry dropped keyboard focus, and that a database error would have logged the submitted values;
  - writing tests found that focus didn't return to the Key field after a create.

  Each fix has a regression test.

**After the hour.** The README, and the fixes to issues raised by an adversarial self-review: the cache races, screen-reader announcements, focus handling, safe error logging, a plain `pnpm test`, and the Windows-safe migrations path.

**Tools.** I built it with [Claude Code](https://claude.com/claude-code) working inside the hub's workflow, under my supervision:

- it planned in slices, and I approved each one;
- it implemented test-first with one commit per change, with commit messages that explain why;
- it ran a separate reviewer agent against the spec;
- I checked the UI by hand, and later it ran browser checks.

Every decision recorded above was reviewed and approved by me before it was built.

**Why this stack.** The brief asked for TypeScript, so I used it end to end:

- **Hono with Zod OpenAPI:** the request and response schemas are the validation and the API contract at once, and the web client is generated from that contract, so the two can't drift apart.
- **Drizzle:** typed queries, with SQL migrations you can read.
- **SQLite:** zero setup, one file.
- **React with TanStack Query:** server state, caching and optimistic updates without writing them by hand.
- **React Hook Form with Zod:** accessible forms with inline validation.
- **Tailwind with CSS variables:** all colours, spacing and fonts live in one file, so the theme can be swapped.
- **Vitest, Testing Library and MSW:** tests that query by role and label, the same way users find things.
- **pino:** structured JSON logs.
- **Biome:** one fast tool for linting and formatting.

No dependencies were added beyond the template's.
