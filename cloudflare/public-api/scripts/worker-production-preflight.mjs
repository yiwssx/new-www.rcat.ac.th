import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sanitizeCloudflareCliOutput } from "../../../scripts/sanitize-cloudflare-cli-output.mjs";
import { createProductionWranglerConfig, validateProductionDatabaseId } from "./productionDeployGuard.mjs";
import { PRODUCTION_D1_RESOURCE_NAME } from "./productionResource.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workerDirectory = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(workerDirectory, "../..");
const sourceConfigPath = path.join(workerDirectory, "wrangler.toml");

export { PRODUCTION_D1_RESOURCE_NAME } from "./productionResource.mjs";

function readArgument(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  return index >= 0 ? String(argv[index + 1] || "").trim() : "";
}

function databaseRecordIds(database) {
  return [database?.uuid, database?.id, database?.database_id]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function assertProductionDatabaseIdentity(databases, expectedDatabaseId) {
  const validatedId = validateProductionDatabaseId(expectedDatabaseId);
  if (!Array.isArray(databases)) {
    throw new Error("unexpected D1 list response shape");
  }

  const matches = databases.filter((database) => database?.name === PRODUCTION_D1_RESOURCE_NAME);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one promoted production D1 resource ${PRODUCTION_D1_RESOURCE_NAME}, found ${matches.length}`);
  }

  const ids = databaseRecordIds(matches[0]);
  if (ids.length === 0) {
    throw new Error("production D1 list record did not expose a database identifier");
  }

  if (!ids.includes(validatedId)) {
    throw new Error("protected production D1 database ID does not match the promoted account-scoped production resource");
  }

  return true;
}

export function buildProductionMigrationListArgs(configPath) {
  return [
    "exec",
    "wrangler",
    "d1",
    "migrations",
    "list",
    PRODUCTION_D1_RESOURCE_NAME,
    "--remote",
    "--config",
    configPath,
    "--env",
    "production",
    "--experimental-provision=false",
    "--experimental-auto-create=false"
  ];
}

export function listPendingProductionMigrations(databaseId = process.env.RCAT_PRODUCTION_D1_DATABASE_ID) {
  const sourceConfig = readFileSync(sourceConfigPath, "utf8");
  const preparedConfig = createProductionWranglerConfig(sourceConfig, databaseId);
  const temporaryConfigPath = path.join(
    workerDirectory,
    `.wrangler.production-preflight-${process.pid}-${Date.now()}.toml`
  );
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  try {
    writeFileSync(temporaryConfigPath, preparedConfig, { encoding: "utf8", mode: 0o600 });
    const result = spawnSync(command, buildProductionMigrationListArgs(temporaryConfigPath), {
      cwd: repositoryRoot,
      env: process.env,
      encoding: "utf8"
    });

    if (result.error) {
      throw result.error;
    }

    const stdout = sanitizeCloudflareCliOutput(result.stdout || "").trim();
    const stderr = sanitizeCloudflareCliOutput(result.stderr || "").trim();

    if (result.status !== 0) {
      const details = [stderr, stdout].filter(Boolean).join("\n");
      throw new Error(
        `Wrangler production migration preflight failed with exit code ${result.status ?? "unknown"}${details ? `\n${details}` : ""}`
      );
    }

    return stdout || "Wrangler returned no pending-migration output.";
  } finally {
    rmSync(temporaryConfigPath, { force: true });
  }
}

export function main(argv = process.argv.slice(2)) {
  const databaseListPath = readArgument("--database-list", argv);
  if (!databaseListPath) {
    throw new Error("--database-list is required");
  }

  const databases = JSON.parse(readFileSync(databaseListPath, "utf8"));
  assertProductionDatabaseIdentity(databases, process.env.RCAT_PRODUCTION_D1_DATABASE_ID);
  console.log("Promoted production D1 physical resource and protected database ID match.");

  if (argv.includes("--verify-identity-only")) {
    return;
  }

  console.log(listPendingProductionMigrations());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
