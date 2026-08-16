import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProductionWranglerConfig } from "./productionDeployGuard.mjs";
import { PRODUCTION_D1_RESOURCE_NAME } from "./productionResource.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workerDirectory = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(workerDirectory, "../..");
const sourceConfigPath = path.join(workerDirectory, "wrangler.toml");

function runWrangler(args, configPath) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["exec", "wrangler", ...args, "--config", configPath, "--env", "production"], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Wrangler command failed with exit code ${result.status ?? "unknown"}`);
  }
}

export function deployProductionWorker() {
  const sourceConfig = readFileSync(sourceConfigPath, "utf8");
  const preparedConfig = createProductionWranglerConfig(sourceConfig, process.env.RCAT_PRODUCTION_D1_DATABASE_ID);
  const temporaryConfigPath = path.join(workerDirectory, `.wrangler.production-${process.pid}-${Date.now()}.toml`);

  try {
    writeFileSync(temporaryConfigPath, preparedConfig, { encoding: "utf8", mode: 0o600 });
    runWrangler(["d1", "migrations", "apply", PRODUCTION_D1_RESOURCE_NAME, "--remote"], temporaryConfigPath);
    runWrangler(["deploy"], temporaryConfigPath);
  } finally {
    rmSync(temporaryConfigPath, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    deployProductionWorker();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
