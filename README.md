# flag-manager

A small feature flag manager: view, create and toggle flags

## Quick start

Requirements: Node 24 and pnpm (`corepack enable` provides the pinned version).

```bash
pnpm bootstrap   # .env from .env.example, dependencies, migrations, API client
pnpm dev         # API on http://localhost:8000, web on http://localhost:5173
pnpm check       # format, lint, types, tests, API client freshness (what CI runs)
```

Other tasks: `pnpm gen-client` (regenerate the API client), `pnpm db:migrate` (apply migrations).
The same tasks exist as [just](https://just.systems) recipes (`just setup`, `just dev`, `just check`); run `just` to list them.

The OpenAPI document is generated into `packages/api-client/openapi.json` by `pnpm gen-client`.
