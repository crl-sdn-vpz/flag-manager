// Project tasks for people without `just`: `pnpm bootstrap | dev | test | check | gen-client | db:migrate`.
// Mirrors the justfile recipe of the same purpose; plain Node so it also runs on Windows.
// Biome lints this file but tsc does not check it: the repo root has no tsconfig, only the packages do.
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
process.chdir(root);

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): void {
  // pnpm is a .cmd shim on Windows, which only resolves through a shell.
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${command} ${args.join(" ")} failed`);
    process.exit(result.status ?? 1);
  }
}

// Like the justfile's `dotenv-load`: read the root .env once; child processes inherit it.
function loadEnv(): void {
  if (existsSync(".env")) process.loadEnvFile(".env");
}

// The admin API's document (packages/api-client) or the evaluation API's (packages/flags-sdk).
function openApiDocument(name: "admin" | "eval" = "admin"): string {
  const result = spawnSync(process.execPath, ["apps/api/src/openapi.ts", name], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function genClient(): void {
  writeFileSync("packages/api-client/openapi.json", openApiDocument());
  run("pnpm", ["--filter", "api-client", "generate"]);
  writeFileSync("packages/flags-sdk/openapi.json", openApiDocument("eval"));
}

function dbMigrate(): void {
  mkdirSync("apps/api/data", { recursive: true });
  run("pnpm", ["--filter", "api", "exec", "drizzle-kit", "migrate"]);
}

function filesIn(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(path.slice(dir.length), readFileSync(path));
  }
  return files;
}

function sameFiles(a: Map<string, Buffer>, b: Map<string, Buffer>): boolean {
  if (a.size !== b.size) return false;
  for (const [path, content] of a) {
    const other = b.get(path);
    if (!other?.equals(content)) return false;
  }
  return true;
}

// Fail if packages/api-client is stale (route or schema changed without gen-client).
function checkClient(): void {
  const tmp = mkdtempSync(join(tmpdir(), "api-client-"));
  try {
    const input = join(tmp, "openapi.json");
    const output = join(tmp, "generated");
    const document = openApiDocument();
    writeFileSync(input, document);
    run("pnpm", ["--filter", "api-client", "--silent", "generate"], {
      ...process.env,
      OPENAPI_INPUT: input,
      OPENAPI_OUTPUT: output,
    });
    const committed = readFileSync("packages/api-client/openapi.json", "utf8");
    const generated = "packages/api-client/src/generated";
    if (committed !== document || !sameFiles(filesIn(generated), filesIn(output))) {
      console.error("packages/api-client is stale: run 'pnpm gen-client' and commit the result.");
      process.exit(1);
    }
    console.log("api-client is up to date");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Fail if packages/flags-sdk/openapi.json is stale (the evaluation route or its schema changed).
function checkFlagsSdk(): void {
  if (readFileSync("packages/flags-sdk/openapi.json", "utf8") !== openApiDocument("eval")) {
    console.error(
      "packages/flags-sdk/openapi.json is stale: run 'pnpm gen-client' and commit the result.",
    );
    process.exit(1);
  }
  console.log("flags-sdk is up to date");
}

const tasks: Record<string, () => void> = {
  bootstrap() {
    if (!existsSync(".env")) copyFileSync(".env.example", ".env");
    loadEnv();
    run("pnpm", ["install"]);
    dbMigrate();
    genClient();
  },
  dev() {
    loadEnv();
    // One process tree: Ctrl+C stops both.
    run("pnpm", ["--parallel", "--filter", "api", "--filter", "web", "run", "dev"]);
  },
  test() {
    loadEnv();
    run("pnpm", ["--filter", "api", "test"]);
    run("pnpm", ["--filter", "flags-sdk", "test"]);
    run("pnpm", ["--filter", "web", "test"]);
  },
  check() {
    loadEnv();
    run("pnpm", ["exec", "biome", "format", "."]);
    run("pnpm", ["exec", "biome", "check", "--formatter-enabled=false", "."]);
    run("pnpm", ["-r", "--if-present", "run", "typecheck"]);
    run("pnpm", ["--filter", "api", "test"]);
    run("pnpm", ["--filter", "flags-sdk", "test"]);
    run("pnpm", ["--filter", "web", "test"]);
    checkClient();
    checkFlagsSdk();
  },
  "gen-client": () => {
    loadEnv();
    genClient();
  },
  "db:migrate": () => {
    loadEnv();
    dbMigrate();
  },
};

const name = process.argv[2] ?? "";
const task = tasks[name];
if (!task) {
  console.error(`Unknown task "${name}". Available: ${Object.keys(tasks).join(", ")}`);
  process.exit(1);
}
task();
