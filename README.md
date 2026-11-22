# flag-manager

A small tool for managing feature flags: the on/off switches a team uses to release a feature step by step, or turn it off quickly, without shipping new code.

On one page you can see every flag, turn it on or off, and create new ones. I built it as a first version that a team could keep extending.

![The flag manager page: the "New flag" form above the list of flags, each with an On/Off switch](docs/screenshot.png)

## How to run

You need **Node 24** (the version is in `.nvmrc`, and pnpm refuses to install with another one) and **pnpm**. Running `corepack enable` gives you the right pnpm version.

```bash
pnpm bootstrap   # one-time setup: installs everything and prepares the database
pnpm dev         # starts the app (Ctrl+C stops it)
pnpm test        # runs the tests
pnpm check       # runs every quality check: format, lint, types, tests
```

Then open http://localhost:5173.

- The first start creates the database and adds five sample flags, so there is something to look at right away.
- To start over, stop the app, delete `apps/api/data/app.db` and start it again.
- If you see `pnpm: not found`, your terminal is using another Node version. Switch to Node 24 and try again.

## How it's built

The project has three parts, all written in TypeScript:

| Part | Folder | What it does |
|---|---|---|
| Web app | `apps/web` | The page you see: the list, the switches and the form (React). |
| API | `apps/api` | Receives the requests, applies the rules and saves the flags (Hono + SQLite). |
| API client | `packages/api-client` | The code the web app uses to talk to the API. It is generated from the API itself, so the two can't drift apart. |

What happens when you turn a flag on:

1. The switch moves right away, so the page feels fast.
2. The web app sends the change to the API.
3. The API checks the request, saves the new state and writes a log line about the change.
4. If anything fails, the switch moves back and the page offers a **Retry** button.

## The API

All routes live under `/api/v1` and speak JSON.

| Action | Request | Result |
|---|---|---|
| List the flags | `GET /flags` | `{ "items": [...] }`, ordered by key |
| Create a flag | `POST /flags` with `{ key, name, description? }` | The new flag, always turned off |
| Turn a flag on or off | `PATCH /flags/{key}` with `{ "enabled": true }` | The updated flag |

A flag looks like this:

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

The rules:

- **`key`** is the flag's identity: 2 to 64 lowercase letters, digits and hyphens, starting with a letter. It must be unique and can't be changed later.
- **`name`** is required, up to 80 characters. **`description`** is optional, up to 280.
- Fields the API doesn't know are rejected, not ignored.

When something goes wrong, every error has the same shape: a `code` (for example `validation_error`, `flag_key_conflict`, `flag_not_found`, or `http_error` when the request body is not JSON), a readable `message`, some `details`, and a `requestId`. That ID also appears in the server logs, so a reported error can be traced to what happened.

The full contract is in `packages/api-client/openapi.json`.

## Assumptions

- A flag has one state for everyone. There are no separate values for development, staging or production yet.
- A flag's key never needs to be renamed.
- One server and one database file are enough at this size.
- Other services don't read flags from this API yet. This is only the management side.

## Decisions I made on purpose

- **You set a flag to on or off; you don't "flip" it.** If the same request arrives twice (a retry, a double click), the result is the same. A flip would undo itself.
- **Setting a flag to the state it already has changes nothing.** "Last updated" stays truthful and the log only records real changes.
- **New flags start turned off.** Creating a flag should never change how the product behaves by itself.
- **The database guarantees that keys are unique.** Two people creating the same key at the same moment can't both succeed.
- **When you're offline, a change fails right away.** The alternative was to send it later, without warning, once the connection returns. For flags, a visible failure with a Retry button is safer.
- **There is no "are you sure?" dialog.** People learn to click through those. Real protection needs environments, a reason for each change and approvals, which come later.
- **Every error includes a request ID.** People report problems by pasting the error message, and the ID connects it to the logs ([ADR 0002](docs/adr/0002-request-id-in-error-body.md)).
- **The list comes wrapped in `{ "items": [] }`.** Paging or totals can be added later without breaking anything.

## What I left out, and why

- **Login and roles.** The brief excludes them. The logs already have a place for "who did it", so adding login later won't change their format.
- **Environments** (development, staging, production). They change the data and every screen, so they are the first thing I'd add next.
- **A way for other services to read flags.** That is a different product: it has to be very fast and handle many reads. It shouldn't be squeezed into an admin tool's first version.
- **History and approvals.** They only make sense once there are users. The change logs are the starting point.
- **Gradual rollouts, targeting, delete, rename, paging, Docker and deployment.** A first version should be easy to read and easy to extend, not broad.

## With another day

1. Edit a flag's description from the list.
2. Answer broken JSON and a missing content type with 422 `validation_error`, like every other invalid request (today they answer 400/415 `http_error`).
3. Make the test output quieter, so a real failure is easier to spot.
4. Briefly highlight a newly created flag in the list.
5. Clear a row's error message when the change did reach the server but its answer was lost.

## How it could grow

- **Environments, with protection that matches the risk:** one click in development, a confirmation and a reason in production, a second person's approval for critical flags.
- **Login, roles and a change history,** built from the change logs that already exist.
- **Postgres instead of SQLite** once more than one server is running. The database code sits in one place, so the change stays small.
- **Tracing across services,** built on the request ID.

## Time and process

**Starting point.** I generated the project from my own template, part of a personal set of templates, coding rules and workflows I use to start projects quickly. That setup happened before the timed build.

**Time.** The build took about **1 hour 40 minutes** against a 60-minute target. The extra time went to:

- **Reviewing each step.** The work was split in three parts (API, page, finish) and I reviewed and approved each one before the next began.
- **Setup problems.** My terminal picked the wrong Node version, the linter needed a setting for the styling syntax, and the automated browser couldn't start on my machine, so I did the first check of the page by hand.
- **Bugs found and fixed.** Changes hung while offline, the Retry button lost keyboard focus, a database error could have logged what the user typed, and focus didn't return to the form after creating a flag. Each fix has a test.

**After the hour.** I wrote this README and fixed the issues a final review raised, mostly around keyboard and screen-reader behavior, timing between requests, and safe error logging.

**Tools.** I built it with [Claude Code](https://claude.com/claude-code) under my supervision. It planned the work in parts, wrote tests first and made one commit per change, and a separate review pass checked the result against the spec. I reviewed and approved every decision described here before it was built.

**Why these tools.**

- **Hono with Zod and OpenAPI:** one definition validates requests and documents the API.
- **SQLite with Drizzle:** nothing to install, one file, and migrations you can read.
- **React with TanStack Query:** handles loading, caching and instant updates.
- **React Hook Form:** accessible forms with inline validation.
- **Tailwind with CSS variables:** every color, space and font lives in one file, so the look can be swapped.
- **Vitest and Testing Library:** tests that find things the way a user does.
- **pino and Biome:** structured logs, and one tool for linting and formatting.
