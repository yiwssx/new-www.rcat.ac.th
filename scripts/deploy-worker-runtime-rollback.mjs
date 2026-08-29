import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProductionWranglerConfig } from "../cloudflare/public-api/scripts/productionDeployGuard.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rollbackRoot = path.join(repositoryRoot, ".p6c-worker-rollback");

function fail(message) {
  throw new Error(`P6C Worker rollback failed: ${message}`);
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    fail(`${name} is required`);
  }
  return process.argv[index + 1];
}

function runWrangler(configPath) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["exec", "wrangler", "deploy", "--config", configPath, "--env", "production"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    fail(`Wrangler deploy exited with ${result.status ?? "unknown"}`);
  }
}

export function deployWorkerRuntimeRollback(workerDirectory) {
  const resolvedWorkerDirectory = path.resolve(workerDirectory);
  const relative = path.relative(rollbackRoot, resolvedWorkerDirectory);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("worker directory must be extracted below .p6c-worker-rollback");
  }

  const sourceConfigPath = path.join(resolvedWorkerDirectory, "wrangler.toml");
  const sourceConfig = readFileSync(sourceConfigPath, "utf8");
  const preparedConfig = createProductionWranglerConfig(sourceConfig, process.env.RCAT_PRODUCTION_D1_DATABASE_ID);
  const temporaryConfigPath = path.join(
    resolvedWorkerDirectory,
    `.wrangler.p6c-rollback-${process.pid}-${Date.now()}.toml`
  );

  try {
    writeFileSync(temporaryConfigPath, preparedConfig, { encoding: "utf8", mode: 0o600 });
    runWrangler(temporaryConfigPath);
  } finally {
    rmSync(temporaryConfigPath, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    deployWorkerRuntimeRollback(readArgument("--worker-dir"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
