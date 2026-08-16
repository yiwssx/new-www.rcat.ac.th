import fs from "node:fs";

const args = process.argv.slice(2);
const command = args.shift();

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    throw new Error(`Missing required option ${name}`);
  }
  return args[index + 1];
}

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deploymentLine(deploymentsText, deploymentId) {
  const matcher = new RegExp(`(^|\\s)${escapeRegex(deploymentId)}(?=\\s|@|$)`);
  const matches = deploymentsText
    .split(/\r?\n/)
    .filter((line) => matcher.test(line));

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one target deployment entry, found ${matches.length}.`,
    );
  }

  return matches[0];
}

function deploymentVersion(deploymentsText, deploymentId) {
  const line = deploymentLine(deploymentsText, deploymentId);
  const match = line.match(/@([0-9]+)(?:\b|\.)/);
  if (!match) {
    throw new Error("Target deployment does not expose an immutable version.");
  }
  return match[1];
}

function validateProjectConfig() {
  const projectFile = readOption("--project");
  const deploymentId = readOption("--deployment-id").trim();
  const config = JSON.parse(readText(projectFile));
  const scriptId = String(config?.scriptId || "").trim();
  const rootDir = config?.rootDir === undefined ? "." : String(config.rootDir);

  if (!scriptId || scriptId === "PUT_YOUR_SCRIPT_ID_HERE") {
    throw new Error("Production clasp project config has no real scriptId.");
  }
  if (rootDir !== ".") {
    throw new Error("Production clasp project config must keep rootDir set to '.'.");
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(deploymentId)) {
    throw new Error("Production Apps Script deployment ID is missing or malformed.");
  }

  console.log("Production Apps Script project/deployment configuration validated.");
}

function printCurrentVersion() {
  const deploymentsFile = readOption("--deployments");
  const deploymentId = readOption("--deployment-id");
  process.stdout.write(deploymentVersion(readText(deploymentsFile), deploymentId));
}

function printCreatedVersion() {
  const file = readOption("--file");
  const matches = [...readText(file).matchAll(/Created version ([0-9]+)\./g)];
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one created Apps Script version, found ${matches.length}.`,
    );
  }
  process.stdout.write(matches[0][1]);
}

function assertDeploymentVersion() {
  const deploymentsFile = readOption("--deployments");
  const deploymentId = readOption("--deployment-id");
  const expectedVersion = readOption("--version");
  const actualVersion = deploymentVersion(
    readText(deploymentsFile),
    deploymentId,
  );

  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Target deployment version mismatch: expected ${expectedVersion}, got ${actualVersion}.`,
    );
  }
  console.log(`Target deployment now references immutable version ${expectedVersion}.`);
}

function assertVersionExists() {
  const versionsFile = readOption("--versions");
  const expectedVersion = readOption("--version");
  if (!/^[0-9]+$/.test(expectedVersion)) {
    throw new Error("Rollback version must be a positive integer.");
  }

  const matcher = new RegExp(`^\\s*${escapeRegex(expectedVersion)}\\s+-`, "m");
  if (!matcher.test(readText(versionsFile))) {
    throw new Error(`Apps Script immutable version ${expectedVersion} was not found.`);
  }
  console.log(`Rollback target immutable version ${expectedVersion} exists.`);
}

function verifyHealth() {
  const file = readOption("--file");
  const payload = JSON.parse(readText(file));
  const expectedResources = [
    "media",
    "media-delete",
    "media-upload-start",
    "media-upload-chunk",
    "media-upload-status",
  ];
  const actualResources = Array.isArray(payload?.resources)
    ? [...payload.resources].sort()
    : [];

  if (payload?.ok !== true || payload?.scope !== "media-file-bridge") {
    throw new Error("Apps Script production health response has the wrong scope.");
  }
  if (actualResources.join("\n") !== [...expectedResources].sort().join("\n")) {
    throw new Error("Apps Script production health response has route drift.");
  }
  console.log("Apps Script production media/file bridge health contract verified.");
}

switch (command) {
  case "validate-config":
    validateProjectConfig();
    break;
  case "current-version":
    printCurrentVersion();
    break;
  case "created-version":
    printCreatedVersion();
    break;
  case "assert-deployment-version":
    assertDeploymentVersion();
    break;
  case "assert-version-exists":
    assertVersionExists();
    break;
  case "verify-health":
    verifyHealth();
    break;
  default:
    throw new Error(`Unknown Apps Script release tool command: ${command || "(none)"}`);
}
