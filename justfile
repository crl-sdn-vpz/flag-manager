set dotenv-load := true
set shell := ["bash", "-euo", "pipefail", "-c"]

# List recipes
default:
    @just --list --unsorted

# First-time setup: env file, dependencies, database, client
setup:
    [ -f .env ] || cp .env.example .env
    pnpm install
    mkdir -p apps/api/data
    just db-upgrade
    just gen-client

# Run the API and the web app together (Ctrl+C stops both)
dev:
    trap 'kill 0' EXIT; just dev-api & just dev-web & wait

dev-api:
    pnpm --filter api dev

dev-web:
    pnpm --filter web dev

# Everything CI runs. Run before saying "done".
check: fmt-check lint typecheck test check-client check-flags-sdk

# All unit and integration tests
test: test-api test-flags-sdk test-web

test-api *args:
    pnpm --filter api test {{ args }}

test-flags-sdk *args:
    pnpm --filter flags-sdk test {{ args }}

test-web *args:
    pnpm --filter web test {{ args }}

lint:
    pnpm exec biome check --formatter-enabled=false .

fmt:
    pnpm exec biome check --write .

fmt-check:
    pnpm exec biome format .

typecheck:
    pnpm -r --if-present run typecheck

# Regenerate packages/api-client and packages/flags-sdk/openapi.json from the API (no server needed)
gen-client:
    just _openapi > packages/api-client/openapi.json
    pnpm --filter api-client generate
    just _openapi eval > packages/flags-sdk/openapi.json

# Fail if packages/api-client is stale (route or schema changed without gen-client)
check-client:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    just _openapi > "$tmp/openapi.json"
    OPENAPI_INPUT="$tmp/openapi.json" OPENAPI_OUTPUT="$tmp/generated" pnpm --filter api-client --silent generate >/dev/null
    if ! diff -q packages/api-client/openapi.json "$tmp/openapi.json" >/dev/null \
      || ! diff -r packages/api-client/src/generated "$tmp/generated" >/dev/null; then
      echo "packages/api-client is stale: run 'just gen-client' and commit the result." >&2
      exit 1
    fi
    echo "api-client is up to date"

# Fail if packages/flags-sdk/openapi.json is stale (the evaluation route or its schema changed)
check-flags-sdk:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! just _openapi eval | diff -q packages/flags-sdk/openapi.json - >/dev/null; then
      echo "packages/flags-sdk/openapi.json is stale: run 'just gen-client' and commit the result." >&2
      exit 1
    fi
    echo "flags-sdk is up to date"

# The OpenAPI document of the admin API, or of the evaluation API with `eval`
_openapi document="admin":
    @cd apps/api && node src/openapi.ts {{ document }}

# New Drizzle migration from schema changes (read the SQL before committing)
db-revision message:
    cd apps/api && pnpm exec drizzle-kit generate --name "{{ message }}"

db-upgrade:
    cd apps/api && pnpm exec drizzle-kit migrate
