import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const auditLevelArgument = process.argv.find((argument) => argument.startsWith("--audit-level="));
const auditLevel = auditLevelArgument?.split("=", 2)[1] || "high";
const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commandPrefix = npmExecPath ? [npmExecPath] : [];
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const localNodeVersion = readFileSync(".node-version", "utf8").trim();
const manifestErrors = [];

function runPnpm(args) {
  const result = spawnSync(command, [...commandPrefix, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`Unable to run pnpm ${args.join(" ")}: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}

function recordManifestCheck(label, passed, detail) {
  console.log(`- ${label}: ${passed ? "PASS" : "FAIL"} (${detail})`);
  if (!passed) {
    manifestErrors.push(`${label}: ${detail}`);
  }
}

function normalizeYamlScalar(value) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function parseDeclaredVersion(specifier) {
  const match = String(specifier || "").match(/(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) {
    return null;
  }

  return {
    full: `${match[1]}.${match[2]}.${match[3]}`,
    major: Number(match[1]),
    prerelease: match[4] || ""
  };
}

function directSpecifier(packageName) {
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const specifier = packageJson[section]?.[packageName];
    if (specifier) {
      return specifier;
    }
  }

  return null;
}

function directVersion(packageName) {
  return parseDeclaredVersion(directSpecifier(packageName));
}

function sameFullVersion(packageNames) {
  const versions = packageNames.map(directVersion);
  return versions.every(Boolean) && new Set(versions.map((version) => version.full)).size === 1;
}

function sameMajorVersion(packageNames) {
  const versions = packageNames.map(directVersion);
  return versions.every(Boolean) && new Set(versions.map((version) => version.major)).size === 1;
}

console.log("Deterministic dependency manifest checks:");

const packageManagerMatch = packageJson.packageManager?.match(/^pnpm@(.+)$/);
const packageManagerPnpm = packageManagerMatch?.[1] || "";
const enginePnpm = packageJson.engines?.pnpm || "";
const ciPnpm = normalizeYamlScalar(ciWorkflow.match(/pnpm\/action-setup@v\d+[\s\S]*?\bversion:\s*([^\s#]+)/)?.[1]);
recordManifestCheck(
  "packageManager, engines, and CI pnpm alignment",
  Boolean(packageManagerPnpm) && packageManagerPnpm === enginePnpm && enginePnpm === ciPnpm,
  `packageManager ${packageManagerPnpm || "missing"}; engines ${enginePnpm || "missing"}; CI ${ciPnpm || "missing"}`
);

const engineNode = packageJson.engines?.node || "";
const ciNode = normalizeYamlScalar(ciWorkflow.match(/\bnode-version:\s*([^\s#]+)/)?.[1]);
const localNodeMajor = parseDeclaredVersion(localNodeVersion)?.major;
const engineNodeMajor = Number(engineNode.match(/^(\d+)\.x$/)?.[1]);
const ciNodeMajor = Number(ciNode?.match(/^(\d+)\.x$/)?.[1]);
recordManifestCheck(
  "Node engine, CI, and local pin alignment",
  Boolean(engineNodeMajor) &&
    engineNode === ciNode &&
    engineNodeMajor === ciNodeMajor &&
    engineNodeMajor === localNodeMajor,
  `engines ${engineNode || "missing"}; CI ${ciNode || "missing"}; local ${localNodeVersion || "missing"}`
);

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const directDeclarations = new Map();
const prereleaseDeclarations = [];
for (const section of dependencySections) {
  for (const [packageName, specifier] of Object.entries(packageJson[section] || {})) {
    const sections = directDeclarations.get(packageName) || [];
    sections.push(section);
    directDeclarations.set(packageName, sections);

    if (parseDeclaredVersion(specifier)?.prerelease) {
      prereleaseDeclarations.push(`${packageName}@${specifier}`);
    }
  }
}

const duplicateDeclarations = [...directDeclarations]
  .filter(([, sections]) => sections.length > 1)
  .map(([packageName, sections]) => `${packageName} (${sections.join(", ")})`);
recordManifestCheck(
  "duplicate direct dependency declarations",
  duplicateDeclarations.length === 0,
  duplicateDeclarations.length ? duplicateDeclarations.join("; ") : "none"
);
recordManifestCheck(
  "prerelease direct dependencies",
  prereleaseDeclarations.length === 0,
  prereleaseDeclarations.length ? prereleaseDeclarations.join("; ") : "none"
);

recordManifestCheck(
  "React ecosystem versions",
  sameFullVersion(["react", "react-dom"]) && sameMajorVersion(["react", "@types/react", "@types/react-dom"]),
  `react ${directSpecifier("react")}; react-dom ${directSpecifier("react-dom")}; types ${directSpecifier("@types/react")}/${directSpecifier("@types/react-dom")}`
);
recordManifestCheck(
  "MUI ecosystem versions",
  sameFullVersion(["@mui/material", "@mui/icons-material"]),
  `material ${directSpecifier("@mui/material")}; icons ${directSpecifier("@mui/icons-material")}`
);
recordManifestCheck(
  "TanStack ecosystem declarations",
  ["@tanstack/react-query", "@tanstack/react-router", "@tanstack/react-table"].every(
    (packageName) => directVersion(packageName) && !directVersion(packageName).prerelease
  ),
  `query ${directSpecifier("@tanstack/react-query")}; router ${directSpecifier("@tanstack/react-router")}; table ${directSpecifier("@tanstack/react-table")}`
);
recordManifestCheck(
  "Tailwind ecosystem versions",
  sameFullVersion(["tailwindcss", "@tailwindcss/postcss"]),
  `tailwindcss ${directSpecifier("tailwindcss")}; postcss plugin ${directSpecifier("@tailwindcss/postcss")}`
);
recordManifestCheck(
  "Commitlint ecosystem majors",
  sameMajorVersion(["@commitlint/cli", "@commitlint/config-conventional"]),
  `CLI ${directSpecifier("@commitlint/cli")}; config ${directSpecifier("@commitlint/config-conventional")}`
);
recordManifestCheck(
  "Cloudflare ecosystem declarations",
  ["wrangler", "@cloudflare/workers-types"].every(
    (packageName) => directVersion(packageName) && !directVersion(packageName).prerelease
  ),
  `wrangler ${directSpecifier("wrangler")}; Worker types ${directSpecifier("@cloudflare/workers-types")}; compatibility enforced by strict peers`
);

console.log("Strict peer validation (frozen, offline, scripts disabled):");
const peerExitCode = runPnpm([
  "install",
  "--frozen-lockfile",
  "--strict-peer-dependencies",
  "--offline",
  "--ignore-scripts"
]);

console.log("Dependency freshness report (informational):");
const outdatedExitCode = runPnpm(["outdated"]);

console.log(`Dependency audit report (enforced at ${auditLevel} severity):`);
const auditExitCode = runPnpm(["audit", "--audit-level", auditLevel]);

console.log(`Production dependency audit report (enforced at ${auditLevel} severity):`);
const productionAuditExitCode = runPnpm(["audit", "--prod", "--audit-level", auditLevel]);

const manifestExitCode = manifestErrors.length ? 1 : 0;
console.log(
  `Dependency check summary: manifest exit ${manifestExitCode}; peers exit ${peerExitCode}; outdated exit ${outdatedExitCode}; audit exit ${auditExitCode}; production audit exit ${productionAuditExitCode}; enforced severity ${auditLevel}.`
);

process.exitCode = manifestExitCode || peerExitCode || auditExitCode || productionAuditExitCode;
