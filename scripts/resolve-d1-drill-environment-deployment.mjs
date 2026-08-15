import fs from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_EARLY_TOLERANCE_MS = 5_000;
const DEFAULT_LATE_TOLERANCE_MS = 30_000;

function normalizeEnvironmentName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseTimestamp(value, label) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) {
    throw new Error(`invalid ${label} timestamp`);
  }
  return timestamp;
}

export function resolveD1DrillEnvironmentDeployment({
  run,
  deployments,
  sha,
  actor,
  earlyToleranceMs = DEFAULT_EARLY_TOLERANCE_MS,
  lateToleranceMs = DEFAULT_LATE_TOLERANCE_MS
}) {
  if (!run || typeof run !== "object") throw new Error("workflow run metadata is required");
  if (!Array.isArray(deployments)) throw new Error("deployments response must be an array");
  if (typeof sha !== "string" || sha.length === 0) throw new Error("workflow SHA is required");
  if (typeof actor !== "string" || actor.length === 0) throw new Error("workflow actor is required");

  const runStartedAt = parseTimestamp(run.run_started_at ?? run.created_at, "workflow run");
  const earliest = runStartedAt - earlyToleranceMs;
  const latest = runStartedAt + lateToleranceMs;

  const candidates = deployments.filter((deployment) => {
    const createdAt = Date.parse(deployment?.created_at ?? "");
    return (
      normalizeEnvironmentName(deployment?.environment) === "production" &&
      deployment?.ref === "master" &&
      deployment?.sha === sha &&
      deployment?.creator?.login === actor &&
      deployment?.performed_via_github_app?.slug === "github-actions" &&
      deployment?.production_environment === false &&
      Number.isFinite(createdAt) &&
      createdAt >= earliest &&
      createdAt <= latest
    );
  });

  if (candidates.length !== 1) {
    throw new Error(`expected exactly one D1 drill environment deployment for this run, found ${candidates.length}`);
  }

  const deploymentId = candidates[0]?.id;
  if (!(typeof deploymentId === "number" || (typeof deploymentId === "string" && deploymentId.length > 0))) {
    throw new Error("matching D1 drill environment deployment has no id");
  }

  return String(deploymentId);
}

function readJson(path, label) {
  if (!path) throw new Error(`${label} path is required`);
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function parseCliArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("expected CLI arguments as --name value pairs");
    }
    args.set(key.slice(2), value);
  }
  return args;
}

export function runCli(argv = process.argv.slice(2), env = process.env) {
  const args = parseCliArgs(argv);
  const run = readJson(args.get("run"), "workflow run JSON");
  const deployments = readJson(args.get("deployments"), "deployments JSON");
  const deploymentId = resolveD1DrillEnvironmentDeployment({
    run,
    deployments,
    sha: args.get("sha") ?? env.GITHUB_SHA,
    actor: args.get("actor") ?? env.GITHUB_ACTOR
  });
  process.stdout.write(deploymentId);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
