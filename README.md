# flag-manager

A small feature flag manager: view, create and toggle flags

## Quick start

Requirements: [just](https://just.systems), Node 24 + pnpm.

```bash
just setup   # .env, dependencies, migrations, API client, git hooks
just dev     # API on http://localhost:8000, web on http://localhost:5173
just check   # everything CI runs
```

Run `just` to list every command.

API docs (while `just dev` runs): OpenAPI document via `just gen-client` → `packages/api-client/openapi.json`.
