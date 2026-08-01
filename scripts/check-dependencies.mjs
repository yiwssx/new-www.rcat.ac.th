import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateCompatibilityExceptionPackages } from "./dependency-status-policy.mjs";

const auditLevel = process.argv.find((argument) => argument.startsWith("--audit-level="))?.split("=", 2)[1] || "high";
const prodAuditLevel =
  process.argv.find((argument) => argument.startsWith("--prod-audit-level="))?.split("=", 2)[1] || "moderate";
const includeOutdated = process.argv.includes("--include-outdated");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const workspaceConfig = readFileSync("pnpm-workspace.yaml", "utf8");
const dependencyPolicy = JSON.parse(readFileSync("config/dependency-policy.json", "utf8"));
const localNodeVersion = readFileSync(".node-version", "utf8").trim();
const manifestErrors = [];

function pnpmInvocation(args) {
  const pnpmCliPath = String(process.env.npm_execpath || "").trim();
  if (pnpmCliPath) {
    return { command: process.execPath, args: [pnpmCliPath, ...args] };
  }
  if (process.platform === "win32") {
    const tokens = ["pnpm", ...args];
    if (tokens.some((token) => !/^[0-9A-Za-z@/_.:=+^~-]+$/.test(token))) {
      throw new Error(`Unsafe pnpm argument: ${args.join(" ")}`);
    }
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", tokens.join(" ")]
    };
  }
  return { command: "pnpm", args };
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: capture ? "utf8" : undefined,
    env: process.env,
    stdio: capture ? "pipe" : "inherit",
    windowsHide: true
  });
  if (result.error) {
    console.error(`Unable to run ${command} ${args.join(" ")}: ${result.error.message}`);
  }
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    error: result.error?.message || ""
  };
}

function runPnpm(args, options) {
  const invocation = pnpmInvocation(args);
  return run(invocation.command, invocation.args, options);
}

function runNode(args, options) {
  return run(process.execPath, args, options);
}

function record(label, passed, detail) {
  console.log(`- ${label}: ${passed ? "PASS" : "FAIL"} (${detail})`);
  if (!passed) manifestErrors.push(`${label}: ${detail}`);
}

function normalizeYamlScalar(value) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function parseVersion(value) {
  const match = String(value || "")
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    raw: `${match[1]}.${match[2]}.${match[3]}${match[4] ? `-${match[4]}` : ""}`,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || ""
  };
}

function parseDeclaredVersion(specifier) {
  const match = String(specifier || "")
    .trim()
    .match(/^(?:\^|~)?(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/);
  return match ? parseVersion(match[1]) : null;
}

function compareVersions(leftValue, rightValue) {
  const left = typeof leftValue === "string" ? parseVersion(leftValue) : leftValue;
  const right = typeof rightValue === "string" ? parseVersion(rightValue) : rightValue;
  if (!left || !right) return Number.NaN;
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (!left.prerelease && !right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  return left.prerelease.localeCompare(right.prerelease);
}

function satisfiesComparator(version, comparator) {
  const match = comparator.match(/^(<=|>=|<|>|=|\^|~)?(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  if (!match) return false;
  const operator = match[1] || "=";
  const target = parseVersion(match[2]);
  const comparison = compareVersions(version, target);
  if (operator === "=") return comparison === 0;
  if (operator === ">") return comparison > 0;
  if (operator === ">=") return comparison >= 0;
  if (operator === "<") return comparison < 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === "~") {
    const upper = { ...target, minor: target.minor + 1, patch: 0, prerelease: "" };
    return comparison >= 0 && compareVersions(version, upper) < 0;
  }
  const upper =
    target.major > 0
      ? { ...target, major: target.major + 1, minor: 0, patch: 0, prerelease: "" }
      : target.minor > 0
        ? { ...target, minor: target.minor + 1, patch: 0, prerelease: "" }
        : { ...target, patch: target.patch + 1, prerelease: "" };
  return comparison >= 0 && compareVersions(version, upper) < 0;
}

function satisfiesRange(versionValue, range) {
  const version = typeof versionValue === "string" ? parseVersion(versionValue) : versionValue;
  if (!version || typeof range !== "string" || !range.trim()) return false;
  return range.split("||").some((alternative) => {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean);
    return comparators.length > 0 && comparators.every((comparator) => satisfiesComparator(version, comparator));
  });
}

function directSpecifier(packageName) {
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const specifier = packageJson[section]?.[packageName];
    if (specifier) return specifier;
  }
  return null;
}

function directVersion(packageName) {
  return parseDeclaredVersion(directSpecifier(packageName));
}

function sameFullVersion(packageNames) {
  const versions = packageNames.map(directVersion);
  return versions.every(Boolean) && new Set(versions.map((version) => version.raw)).size === 1;
}

function sameMajorVersion(packageNames) {
  const versions = packageNames.map(directVersion);
  return versions.every(Boolean) && new Set(versions.map((version) => version.major)).size === 1;
}

function readInstalledPackage(packageName) {
  const path = resolve("node_modules", ...packageName.split("/"), "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function yamlList(key) {
  const match = workspaceConfig.match(new RegExp(`^${key}:\\s*\\r?\\n((?:\\s+-[^\\r\\n]+\\r?\\n?)*)`, "m"));
  return match ? [...match[1].matchAll(/^\s+-\s+([^\s#]+)/gm)].map((item) => normalizeYamlScalar(item[1])) : [];
}

console.log("Deterministic dependency manifest and policy checks:");

const packageManagerMatch = packageJson.packageManager?.match(/^pnpm@(.+)$/);
const packageManagerPnpm = packageManagerMatch?.[1] || "";
const enginePnpm = packageJson.engines?.pnpm || "";
const ciPnpm = normalizeYamlScalar(ciWorkflow.match(/pnpm\/action-setup@v\d+[\s\S]*?\bversion:\s*([^\s#]+)/)?.[1]);
const actualPnpmResult = runPnpm(["--version"], { capture: true });
const actualPnpm = actualPnpmResult.stdout.trim();
record(
  "packageManager, engines, CI, and active pnpm alignment",
  actualPnpmResult.status === 0 &&
    Boolean(packageManagerPnpm) &&
    packageManagerPnpm === enginePnpm &&
    enginePnpm === ciPnpm &&
    ciPnpm === actualPnpm,
  `packageManager ${packageManagerPnpm || "missing"}; engines ${enginePnpm || "missing"}; CI ${
    ciPnpm || "missing"
  }; active ${actualPnpm || `exit ${actualPnpmResult.status}`}`
);

const engineNode = packageJson.engines?.node || "";
const engineNodeMajor = Number(engineNode.match(/^(\d+)\.x$/)?.[1]);
const localNode = parseVersion(localNodeVersion);
const actualNode = parseVersion(process.versions.node);
const ciNodeVersionFile = normalizeYamlScalar(ciWorkflow.match(/\bnode-version-file:\s*([^\s#]+)/)?.[1]);
record(
  "Node engine, CI, local pin, and active runtime alignment",
  Boolean(engineNodeMajor) &&
    ciNodeVersionFile === ".node-version" &&
    localNode?.major === engineNodeMajor &&
    actualNode?.raw === localNode?.raw,
  `engines ${engineNode || "missing"}; CI file ${ciNodeVersionFile || "missing"}; local ${
    localNodeVersion || "missing"
  }; active ${process.versions.node}`
);

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const declarations = new Map();
const prereleases = [];
const invalidSpecifiers = [];
for (const section of dependencySections) {
  for (const [name, specifier] of Object.entries(packageJson[section] || {})) {
    const sections = declarations.get(name) || [];
    sections.push(section);
    declarations.set(name, sections);
    const version = parseDeclaredVersion(specifier);
    if (!version) invalidSpecifiers.push(`${name}@${specifier}`);
    else if (version.prerelease) prereleases.push(`${name}@${specifier}`);
  }
}
const duplicates = [...declarations]
  .filter(([, sections]) => sections.length > 1)
  .map(([name, sections]) => `${name} (${sections.join(", ")})`);
record(
  "duplicate direct dependency declarations",
  duplicates.length === 0,
  duplicates.length ? duplicates.join("; ") : "none"
);
record(
  "valid direct dependency specifiers",
  invalidSpecifiers.length === 0,
  invalidSpecifiers.length ? invalidSpecifiers.join("; ") : "all exact, caret, or tilde stable semver"
);
record(
  "prerelease direct dependencies",
  prereleases.length === 0,
  prereleases.length ? prereleases.join("; ") : "none"
);

record(
  "React and React type alignment",
  sameFullVersion(["react", "react-dom"]) && sameMajorVersion(["react", "@types/react", "@types/react-dom"]),
  `react ${directSpecifier("react")}; react-dom ${directSpecifier("react-dom")}; types ${directSpecifier(
    "@types/react"
  )}/${directSpecifier("@types/react-dom")}`
);
record(
  "MUI and icons alignment",
  sameFullVersion(["@mui/material", "@mui/icons-material"]),
  `material ${directSpecifier("@mui/material")}; icons ${directSpecifier("@mui/icons-material")}`
);
record(
  "Tailwind and PostCSS plugin alignment",
  sameFullVersion(["tailwindcss", "@tailwindcss/postcss"]) && directVersion("postcss")?.major === 8,
  `tailwindcss ${directSpecifier("tailwindcss")}; plugin ${directSpecifier(
    "@tailwindcss/postcss"
  )}; postcss ${directSpecifier("postcss")}`
);
record(
  "Commitlint major alignment",
  sameMajorVersion(["@commitlint/cli", "@commitlint/config-conventional"]),
  `CLI ${directSpecifier("@commitlint/cli")}; config ${directSpecifier("@commitlint/config-conventional")}`
);

const typescript = directVersion("typescript");
const typescriptEslint = readInstalledPackage("typescript-eslint");
const typescriptPeerRange = typescriptEslint?.peerDependencies?.typescript;
record(
  "TypeScript and typescript-eslint peer alignment",
  Boolean(typescript && typescriptEslint?.version && satisfiesRange(typescript, typescriptPeerRange)),
  `typescript ${directSpecifier("typescript")}; typescript-eslint ${
    typescriptEslint?.version || "missing"
  }; peer ${typescriptPeerRange || "missing"}`
);

const nodeTypes = directVersion("@types/node");
record(
  "Node runtime and @types/node major alignment",
  Boolean(localNode && nodeTypes && localNode.major === nodeTypes.major && engineNodeMajor === nodeTypes.major),
  `runtime ${localNodeVersion}; engines ${engineNode}; @types/node ${directSpecifier("@types/node")}`
);

const compatibilityPolicyErrors = [];
const compatibilityExceptions = dependencyPolicy?.compatibilityExceptions;
const configuredExceptionPackages = validateCompatibilityExceptionPackages(compatibilityExceptions);
compatibilityPolicyErrors.push(...configuredExceptionPackages.errors);
for (const [packageName, exception] of Object.entries(compatibilityExceptions || {})) {
  const selected = parseVersion(exception?.selected);
  const direct = directVersion(packageName);
  const installedPackage = readInstalledPackage(packageName);
  const validation = exception?.validation;
  if (!selected || selected.prerelease) {
    compatibilityPolicyErrors.push(`${packageName} selected version is not stable semantic version`);
  }
  if (!direct || direct.raw !== selected?.raw) {
    compatibilityPolicyErrors.push(`${packageName} selected version does not match the manifest`);
  }
  if (!installedPackage?.version || installedPackage.version !== selected?.raw) {
    compatibilityPolicyErrors.push(`${packageName} selected version does not match the installed lockfile result`);
  }
  if (!Number.isInteger(exception?.blockedLatestMajor) || exception.blockedLatestMajor <= (selected?.major ?? -1)) {
    compatibilityPolicyErrors.push(`${packageName} blockedLatestMajor must be greater than the selected major`);
  }
  if (typeof exception?.reason !== "string" || exception.reason.trim().length < 20) {
    compatibilityPolicyErrors.push(`${packageName} reason is missing or too short`);
  }
  if (!Array.isArray(exception?.verifyWith) || exception.verifyWith.some((command) => typeof command !== "string")) {
    compatibilityPolicyErrors.push(`${packageName} verifyWith commands are missing or invalid`);
  }
  if (validation?.kind === "peer-range") {
    const peerPackage = readInstalledPackage(validation.peerPackage);
    const peerRange = peerPackage?.peerDependencies?.[validation.peerDependency];
    if (validation.peerDependency !== packageName || !selected || !satisfiesRange(selected, peerRange)) {
      compatibilityPolicyErrors.push(`${packageName} selected version does not satisfy the installed peer range`);
    }
  } else if (validation?.kind === "runtime-major") {
    if (validation.runtimeFile !== ".node-version" || !selected || selected.major !== localNode?.major) {
      compatibilityPolicyErrors.push(`${packageName} selected major does not match the committed Node runtime`);
    }
  } else {
    compatibilityPolicyErrors.push(`${packageName} validation kind is missing or unsupported`);
  }
}
record(
  "committed compatibility exception policy",
  compatibilityPolicyErrors.length === 0,
  compatibilityPolicyErrors.length
    ? compatibilityPolicyErrors.join("; ")
    : "allowlist, selections, and local constraints align"
);

const wrangler = readInstalledPackage("wrangler");
const wranglerVersion = directVersion("wrangler");
const workersTypes = directVersion("@cloudflare/workers-types");
const workersTypesPeerRange = wrangler?.peerDependencies?.["@cloudflare/workers-types"];
record(
  "Wrangler and Cloudflare Worker types compatibility",
  Boolean(
    wranglerVersion &&
    workersTypes &&
    wrangler?.version === wranglerVersion.raw &&
    satisfiesRange(workersTypes, workersTypesPeerRange)
  ),
  `wrangler ${directSpecifier("wrangler")}/${wrangler?.version || "missing"}; workers types ${directSpecifier(
    "@cloudflare/workers-types"
  )}; peer ${workersTypesPeerRange || "missing"}`
);

record(
  "bcryptjs bundled type ownership",
  !directSpecifier("@types/bcryptjs") && (directVersion("bcryptjs")?.major || 0) >= 3,
  `bcryptjs ${directSpecifier("bcryptjs")}; @types/bcryptjs ${directSpecifier("@types/bcryptjs") || "absent"}`
);

const onlyBuiltDependencies = yamlList("onlyBuiltDependencies").sort();
record(
  "pnpm build-script allowlist",
  JSON.stringify(onlyBuiltDependencies) === JSON.stringify(["esbuild", "sharp", "workerd"]),
  onlyBuiltDependencies.length ? onlyBuiltDependencies.join(", ") : "missing"
);
record(
  "pnpm strict dependency builds",
  /^strictDepBuilds:\s*true\s*$/m.test(workspaceConfig),
  /^strictDepBuilds:\s*true\s*$/m.test(workspaceConfig) ? "true" : "missing or false"
);
record(
  "pnpm minimum release age",
  /^minimumReleaseAge:\s*4320\s*$/m.test(workspaceConfig) && !/^minimumReleaseAgeExclude:/m.test(workspaceConfig),
  /^minimumReleaseAge:\s*4320\s*$/m.test(workspaceConfig)
    ? "4320 minutes; no persistent exclusions"
    : "missing or not 4320 minutes"
);

const ciInstall = ciWorkflow.match(/^\s*-\s+run:\s*(pnpm install[^\r\n]*)$/m)?.[1] || "";
record(
  "CI frozen strict-peer online install",
  ciInstall.includes("--frozen-lockfile") &&
    ciInstall.includes("--strict-peer-dependencies") &&
    !ciInstall.includes("--offline"),
  ciInstall || "missing"
);
record(
  "CI blocking dependency gates",
  !/\bcontinue-on-error\s*:\s*true\b|\|\|\s*true/u.test(ciWorkflow),
  "no continue-on-error or || true"
);
record(
  "CI excludes live registry freshness",
  !ciWorkflow.includes("pnpm deps:latest:check"),
  ciWorkflow.includes("pnpm deps:latest:check")
    ? "pnpm deps:latest:check is still in blocking push/pull-request CI"
    : "live freshness is handled outside blocking push/pull-request CI"
);

const manifestExit = manifestErrors.length ? 1 : 0;

console.log("Strict peer validation (frozen, offline, scripts disabled):");
const peerExit = runPnpm([
  "install",
  "--frozen-lockfile",
  "--strict-peer-dependencies",
  "--offline",
  "--ignore-scripts"
]).status;

console.log(`Full dependency audit (enforced at ${auditLevel}):`);
const auditExit = runPnpm(["audit", "--audit-level", auditLevel]).status;

console.log(`Production dependency audit (enforced at ${prodAuditLevel}):`);
const prodAuditExit = runPnpm(["audit", "--prod", "--audit-level", prodAuditLevel]).status;

console.log("Dependency documentation freshness:");
const docsExit = runNode(["scripts/generate-dependency-status.mjs", "--check"]).status;

let outdatedExit = "not-run";
if (includeOutdated) {
  console.log("Dependency freshness report (informational; exit 1 can mean outdated packages):");
  outdatedExit = runPnpm(["outdated", "--format", "json"]).status;
}

const exitCodes = {
  manifest: manifestExit,
  peers: peerExit,
  audit: auditExit,
  productionAudit: prodAuditExit,
  documentationFreshness: docsExit,
  outdatedInformational: outdatedExit
};
console.log(
  `Dependency check summary: ${Object.entries(exitCodes)
    .map(([label, exitCode]) => `${label}=${exitCode}`)
    .join("; ")}.`
);

process.exitCode = [manifestExit, peerExit, auditExit, prodAuditExit, docsExit].some((exitCode) => exitCode !== 0)
  ? 1
  : 0;
