import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import {
  ACCEPTED_DEPENDENCY_STATUSES,
  classifyDependencyStatus,
  compareVersions,
  parseMinimumReleaseAgeMinutes,
  parseVersion,
  validatePeerRangeCompatibility
} from "./dependency-status-policy.mjs";

const PACKAGE_PATH = "package.json";
const LOCK_PATH = "pnpm-lock.yaml";
const WORKSPACE_PATH = "pnpm-workspace.yaml";
const POLICY_PATH = "config/dependency-policy.json";
const OUTPUT_PATH = "docs/maintenance/dependency-current-status.md";
const COMMAND_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const REGISTRY_CONCURRENCY = 8;
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const flags = new Set(process.argv.slice(2));

function hashFile(path) {
  if (!existsSync(path)) return "missing";
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function pnpmInvocation(args) {
  if (process.env.npm_execpath && /pnpm/i.test(basename(process.env.npm_execpath))) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args]
    };
  }
  if (process.platform === "win32") {
    const safeTokens = [pnpmCommand, ...args];
    if (safeTokens.some((token) => !/^[0-9A-Za-z@/_.:+^~-]+$/.test(token))) {
      throw new Error(`Unsafe pnpm argument: ${args.join(" ")}`);
    }
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", safeTokens.join(" ")]
    };
  }
  return { command: pnpmCommand, args };
}

function runPnpm(args) {
  const invocation = pnpmInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: "pipe",
    timeout: COMMAND_TIMEOUT_MS
  });
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || ""
  };
}

function runPnpmAsync(args) {
  const invocation = pnpmInvocation(args);
  return new Promise((resolveResult) => {
    let stdout = "";
    let stderr = "";
    let error = "";
    let settled = false;
    let timedOut = false;
    let timer;
    const child = spawn(invocation.command, invocation.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const finish = (status, signal) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolveResult({ status, signal, stdout, stderr, error });
    };
    const append = (current, chunk) => {
      const next = current + chunk.toString();
      if (Buffer.byteLength(next) > MAX_OUTPUT_BYTES) {
        error = `Command output exceeded ${MAX_OUTPUT_BYTES} bytes`;
        child.kill();
      }
      return next;
    };
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", (spawnError) => {
      error = spawnError.message;
      finish(null, null);
    });
    child.on("close", (status, signal) => {
      if (timedOut && !error) error = `Command timed out after ${COMMAND_TIMEOUT_MS}ms`;
      finish(status, signal);
    });
    timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, COMMAND_TIMEOUT_MS);
  });
}

function summarizeError(value) {
  const text = String(value || "")
    .replaceAll(process.cwd(), "<repo>")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 240) : "No diagnostic output";
}

function commandFailure(result) {
  if (result.error) return result.error;
  if (result.signal) return `terminated by signal ${result.signal}`;
  return "";
}

function actionableStderr(stderr) {
  return String(stderr || "")
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^npm warn Unknown (?:env|project) config ".+"\. This will stop working in the next major version of npm\./i.test(
          line.trim()
        )
    )
    .join("\n")
    .trim();
}

function stderrHasRegistryError(stderr) {
  return /(?:ERR_PNPM|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|network|registry|fetch failed|certificate|unauthori[sz]ed|forbidden)/i.test(
    actionableStderr(stderr)
  );
}

function parseRequiredJson(result, label) {
  const failure = commandFailure(result);
  if (failure) throw new Error(`${label} failed: ${summarizeError(failure)}`);
  if (!result.stdout.trim()) throw new Error(`${label} returned no JSON output.`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${summarizeError(error.message)}`, { cause: error });
  }
}

function requireSuccessfulJson(result, label) {
  if (result.status !== 0) {
    throw new Error(
      `${label} exited ${result.status ?? "without an exit code"}: ${summarizeError(
        actionableStderr(result.stderr) || result.error
      )}`
    );
  }
  if (stderrHasRegistryError(result.stderr)) {
    throw new Error(`${label} reported a registry error: ${summarizeError(result.stderr)}`);
  }
  return parseRequiredJson(result, label);
}

function parseDeclaredVersion(specifier) {
  const match = String(specifier || "")
    .trim()
    .match(/^(?:\^|~)?(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/);
  return match ? parseVersion(match[1]) : null;
}

function maxStableVersion(values, predicate = () => true) {
  const versions = values
    .map((value) => parseVersion(value))
    .filter((version) => version && !version.prerelease && predicate(version));
  versions.sort(compareVersions);
  return versions.at(-1)?.raw || "";
}

function normalizeVersionList(value, label) {
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.some((version) => !parseVersion(version))) {
    throw new Error(`${label} returned an invalid version list.`);
  }
  return values;
}

function normalizeOutdatedData(value) {
  const entries = Array.isArray(value)
    ? value.map((entry) => [entry?.name, entry])
    : Object.entries(value && typeof value === "object" ? value : {});
  const normalized = {};
  for (const [name, entry] of entries) {
    if (!name || !entry || typeof entry !== "object" || !parseVersion(entry.latest)) {
      throw new Error("pnpm outdated returned an invalid package record.");
    }
    for (const field of ["current", "wanted"]) {
      if (entry[field] !== undefined && !parseVersion(entry[field])) {
        throw new Error(`pnpm outdated returned an invalid ${field} version for ${name}.`);
      }
    }
    normalized[name] = entry;
  }
  return normalized;
}

function readListResult(result) {
  if (result.status !== 0) {
    throw new Error(
      `pnpm list --depth 0 --json exited ${result.status ?? "without an exit code"}: ${summarizeError(
        actionableStderr(result.stderr) || result.error
      )}`
    );
  }
  const value = parseRequiredJson(result, "pnpm list --depth 0 --json");
  const root = Array.isArray(value) ? value[0] : value;
  if (!root || typeof root !== "object") {
    throw new Error("pnpm list --depth 0 --json did not return a root project.");
  }
  return {
    ...(root.dependencies || {}),
    ...(root.devDependencies || {}),
    ...(root.optionalDependencies || {}),
    ...(root.peerDependencies || {})
  };
}

function readOutdatedResult(result) {
  if (![0, 1].includes(result.status)) {
    throw new Error(
      `pnpm outdated --format json exited ${result.status ?? "without an exit code"}: ${summarizeError(
        actionableStderr(result.stderr) || result.error
      )}`
    );
  }
  if (stderrHasRegistryError(result.stderr)) {
    throw new Error(`pnpm outdated reported a registry error: ${summarizeError(result.stderr)}`);
  }
  const normalized = normalizeOutdatedData(parseRequiredJson(result, "pnpm outdated --format json"));
  if (result.status === 1 && Object.keys(normalized).length === 0) {
    throw new Error(
      `pnpm outdated exited 1 without outdated package data: ${summarizeError(
        actionableStderr(result.stderr) || result.error
      )}`
    );
  }
  return normalized;
}

function readAuditResult(result, label) {
  let parsed;
  try {
    parsed = parseRequiredJson(result, label);
  } catch (error) {
    return {
      status: "ERROR",
      low: null,
      moderate: null,
      high: null,
      critical: null,
      exit: result.status,
      error: error.message
    };
  }
  const counts = parsed?.metadata?.vulnerabilities;
  const requiredLevels = ["low", "moderate", "high", "critical"];
  if (
    !counts ||
    requiredLevels.some((level) => !Number.isInteger(Number(counts[level])) || Number(counts[level]) < 0)
  ) {
    return {
      status: "ERROR",
      low: null,
      moderate: null,
      high: null,
      critical: null,
      exit: result.status,
      error: `${label} returned JSON without complete vulnerability counts.`
    };
  }
  const normalized = Object.fromEntries(requiredLevels.map((level) => [level, Number(counts[level])]));
  const total = Object.values(normalized).reduce((sum, count) => sum + count, 0);
  const registryError = stderrHasRegistryError(result.stderr);
  if (registryError || ![0, 1].includes(result.status) || (result.status !== 0 && total === 0)) {
    return {
      status: "ERROR",
      ...normalized,
      exit: result.status,
      error: registryError
        ? summarizeError(actionableStderr(result.stderr))
        : `Unexpected audit exit code ${result.status ?? "none"} with ${total} reported vulnerabilities.`
    };
  }
  return {
    status: total === 0 ? "PASS" : "FAIL",
    ...normalized,
    exit: result.status,
    error: ""
  };
}

function directDependencyRows(packageJson) {
  const rows = [];
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, specifier] of Object.entries(packageJson[section] || {})) {
      rows.push({ name, section, specifier, manifestVersion: parseDeclaredVersion(specifier) });
    }
  }
  return rows;
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function lookupRegistryLatest(packageNames) {
  const results = await mapWithConcurrency(packageNames, REGISTRY_CONCURRENCY, async (name) => {
    try {
      const value = requireSuccessfulJson(
        await runPnpmAsync(["view", name, "dist-tags.latest", "--json"]),
        `pnpm view ${name} dist-tags.latest --json`
      );
      const version = parseVersion(value);
      if (!version || version.prerelease) {
        throw new Error(`Registry latest for ${name} is not a stable semantic version: ${String(value)}`);
      }
      return { name, version: version.raw, error: "" };
    } catch (error) {
      return { name, version: "", error: error.message };
    }
  });
  const errors = results.filter((result) => result.error);
  if (errors.length) {
    throw new Error(
      `Registry latest lookup failed for ${errors.map((result) => `${result.name}: ${result.error}`).join("; ")}`
    );
  }
  return new Map(results.map((result) => [result.name, result.version]));
}

async function lookupRegistryReleaseMetadata(packageNames) {
  const results = await mapWithConcurrency(packageNames, REGISTRY_CONCURRENCY, async (name) => {
    try {
      const value = requireSuccessfulJson(
        await runPnpmAsync(["view", name, "dist-tags", "versions", "time", "--json"]),
        `pnpm view ${name} dist-tags versions time --json`
      );
      const latest = parseVersion(value?.["dist-tags"]?.latest);
      if (!latest || latest.prerelease) {
        throw new Error(
          `Registry latest for ${name} is not a stable semantic version: ${String(value?.["dist-tags"]?.latest)}`
        );
      }
      const versions = normalizeVersionList(
        value?.versions,
        `pnpm view ${name} dist-tags versions time --json versions`
      );
      if (!value?.time || typeof value.time !== "object" || Array.isArray(value.time)) {
        throw new Error(`Registry time metadata for ${name} is not an object.`);
      }
      return { name, latest: latest.raw, versions, releaseTimes: value.time, error: "" };
    } catch (error) {
      return { name, latest: "", versions: [], releaseTimes: null, error: error.message };
    }
  });
  const errors = results.filter((result) => result.error);
  if (errors.length) {
    throw new Error(
      `Registry metadata lookup failed for ${errors.map((result) => `${result.name}: ${result.error}`).join("; ")}`
    );
  }
  return {
    registryLatest: new Map(results.map((result) => [result.name, result.latest])),
    versions: new Map(results.map((result) => [result.name, result.versions])),
    releaseTimes: new Map(results.map((result) => [result.name, result.releaseTimes]))
  };
}

async function fetchMajorVersions(packageName, major) {
  const label = `pnpm view ${packageName}@${major} version --json`;
  const value = requireSuccessfulJson(
    await runPnpmAsync(["view", `${packageName}@${major}`, "version", "--json"]),
    label
  );
  return normalizeVersionList(value, label);
}

function resolveRepoFile(path) {
  if (typeof path !== "string" || !path || isAbsolute(path)) return "";
  const absolute = resolve(process.cwd(), path);
  const relation = relative(process.cwd(), absolute);
  if (relation.startsWith(`..${sep}`) || relation === "..") return "";
  return absolute;
}

async function validateCompatibilityException({ packageName, exception, directByName, installed, registryLatest }) {
  const errors = [];
  const direct = directByName.get(packageName);
  const installedVersion = parseVersion(installed.get(packageName));
  const latestVersion = parseVersion(registryLatest.get(packageName));
  const selected = parseVersion(exception?.selected);
  const validation = exception?.validation;

  if (!direct) errors.push("package is not a direct dependency");
  if (!exception || typeof exception !== "object") errors.push("policy entry is not an object");
  if (!selected || selected.prerelease) errors.push("selected must be an exact stable semantic version");
  if (!installedVersion) errors.push("selected package is not installed");
  if (!latestVersion) errors.push("registry latest is unavailable");
  if (!Number.isInteger(exception?.blockedLatestMajor)) errors.push("blockedLatestMajor must be an integer");
  if (typeof exception?.reason !== "string" || exception.reason.trim().length < 20) {
    errors.push("reason must explain the package-specific compatibility constraint");
  }
  if (!Array.isArray(exception?.verifyWith) || !exception.verifyWith.length) {
    errors.push("verifyWith must list the registry verification commands");
  }
  if (direct?.manifestVersion && selected && direct.manifestVersion.raw !== selected.raw) {
    errors.push(`selected ${selected.raw} does not match manifest ${direct.specifier}`);
  }
  if (direct && !direct.manifestVersion) errors.push(`manifest specifier ${direct.specifier} is invalid`);
  if (installedVersion && selected && installedVersion.raw !== selected.raw) {
    errors.push(`selected ${selected.raw} does not match installed ${installedVersion.raw}`);
  }
  if (latestVersion && exception?.blockedLatestMajor !== latestVersion.major) {
    errors.push(
      `blockedLatestMajor ${String(exception?.blockedLatestMajor)} does not match registry latest major ${latestVersion.major}`
    );
  }
  if (selected && latestVersion) {
    const versionOrder = compareVersions(selected, latestVersion);
    if (versionOrder === 0) {
      errors.push("exception is stale because selected already equals registry latest");
    } else if (versionOrder > 0) {
      errors.push(`selected ${selected.raw} is newer than registry latest ${latestVersion.raw}`);
    }
  }
  if (!validation || typeof validation !== "object") {
    errors.push("validation configuration is missing");
  } else if (validation.kind === "peer-range" && selected && latestVersion) {
    const peerPackage = validation.peerPackage;
    const peerDependency = validation.peerDependency;
    const peerDirect = directByName.get(peerPackage);
    const peerInstalled = installed.get(peerPackage);
    if (!peerDirect || !peerInstalled) {
      errors.push(`${peerPackage || "peer package"} must be a direct installed dependency`);
    } else {
      const label = `pnpm view ${peerPackage}@${peerInstalled} version peerDependencies --json`;
      const metadata = requireSuccessfulJson(
        await runPnpmAsync(["view", `${peerPackage}@${peerInstalled}`, "version", "peerDependencies", "--json"]),
        label
      );
      const peerRange = metadata?.peerDependencies?.[peerDependency];
      if (metadata?.version !== peerInstalled) {
        errors.push(`${peerPackage} registry metadata does not match installed ${peerInstalled}`);
      }
      if (peerDependency !== packageName || typeof peerRange !== "string") {
        errors.push(`${peerPackage} does not declare a verifiable peer range for ${packageName}`);
      } else {
        let availableVersions;
        if (latestVersion.major - selected.major > 10) {
          availableVersions = [selected.raw];
        } else {
          const versionGroups = await Promise.all(
            Array.from(
              { length: Math.max(1, latestVersion.major - selected.major + 1) },
              (_, index) => selected.major + index
            ).map((major) => fetchMajorVersions(packageName, major))
          );
          availableVersions = versionGroups.flat();
        }
        const peerValidation = validatePeerRangeCompatibility({
          selectedVersion: selected.raw,
          registryLatest: latestVersion.raw,
          peerRange,
          availableVersions,
          peerPackage
        });
        errors.push(...peerValidation.errors);
      }
    }
  } else if (validation.kind === "runtime-major" && selected && latestVersion) {
    const runtimePath = resolveRepoFile(validation.runtimeFile);
    if (!runtimePath || !existsSync(runtimePath)) {
      errors.push("runtimeFile must reference an existing repository file");
    } else {
      const runtimeVersion = parseVersion(readFileSync(runtimePath, "utf8").trim());
      if (!runtimeVersion) {
        errors.push(`${validation.runtimeFile} does not contain a semantic version`);
      } else {
        if (selected.major !== runtimeVersion.major) {
          errors.push(`selected major ${selected.major} does not match runtime major ${runtimeVersion.major}`);
        }
        if (latestVersion.major === runtimeVersion.major) {
          errors.push("exception is stale because registry latest matches the runtime major");
        }
        const versions = await fetchMajorVersions(packageName, runtimeVersion.major);
        const latestRuntimeMajor = maxStableVersion(versions);
        if (latestRuntimeMajor !== selected.raw) {
          errors.push(
            `selected ${selected.raw} is not latest in runtime major ${runtimeVersion.major} (${latestRuntimeMajor || "none"})`
          );
        }
      }
    }
  } else if (validation?.kind) {
    errors.push(`unsupported validation kind ${validation.kind}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    reason: exception?.reason || ""
  };
}

async function validateCompatibilityPolicy({ policy, directRows, installed, registryLatest }) {
  const directByName = new Map(directRows.map((row) => [row.name, row]));
  const exceptions = policy?.compatibilityExceptions;
  if (!exceptions || typeof exceptions !== "object" || Array.isArray(exceptions)) {
    throw new Error(`${POLICY_PATH} must contain a compatibilityExceptions object.`);
  }
  const installedVersions = new Map(
    [...installed].map(([name, record]) => [name, parseVersion(record?.version)?.raw || ""])
  );
  const validations = await mapWithConcurrency(Object.entries(exceptions), 4, async ([packageName, exception]) => {
    const result = await validateCompatibilityException({
      packageName,
      exception,
      directByName,
      installed: installedVersions,
      registryLatest
    });
    return [packageName, result];
  });
  return new Map(validations);
}

function auditCell(value) {
  return value === null ? "—" : String(value);
}

function markdownCell(value) {
  return String(value ?? "—")
    .replace(/\s+/g, " ")
    .replaceAll("|", "\\|")
    .trim();
}

function markdownTable(headers, alignments, rows) {
  const stringRows = [headers, ...rows].map((row) => row.map((cell) => String(cell)));
  const widths = headers.map((_, column) => Math.max(3, ...stringRows.map((row) => row[column]?.length || 0)));
  const renderRow = (row) =>
    `| ${row
      .map((cell, column) => {
        const value = String(cell);
        return alignments[column] === "right" ? value.padStart(widths[column]) : value.padEnd(widths[column]);
      })
      .join(" | ")} |`;
  const separators = widths.map((width, column) =>
    alignments[column] === "right" ? `${"-".repeat(Math.max(2, width - 1))}:` : "-".repeat(width)
  );
  return [renderRow(headers), `| ${separators.join(" | ")} |`, ...rows.map(renderRow)];
}

function bangkokIsoTimestamp() {
  const bangkokOffsetMilliseconds = 7 * 60 * 60 * 1000;
  return new Date(Date.now() + bangkokOffsetMilliseconds).toISOString().replace(/\.\d{3}Z$/u, "+07:00");
}

function generatedAtForInputs(packageHash, lockHash, workspaceHash, policyHash, reportHash) {
  if (existsSync(OUTPUT_PATH)) {
    const content = readFileSync(OUTPUT_PATH, "utf8");
    const currentHashes =
      content.includes(`package-json-sha256: ${packageHash}`) &&
      content.includes(`pnpm-lock-sha256: ${lockHash}`) &&
      content.includes(`pnpm-workspace-sha256: ${workspaceHash}`) &&
      content.includes(`dependency-policy-sha256: ${policyHash}`) &&
      content.includes(`report-data-sha256: ${reportHash}`);
    const generatedAt = content.match(/^- Generated at: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00)$/mu)?.[1];
    if (currentHashes && generatedAt) {
      return generatedAt;
    }
  }
  return bangkokIsoTimestamp();
}

function checkFreshness(packageHash, lockHash, workspaceHash, policyHash) {
  if (!existsSync(OUTPUT_PATH)) {
    console.error(`${OUTPUT_PATH} is missing. Run pnpm deps:status.`);
    return 1;
  }
  const content = readFileSync(OUTPUT_PATH, "utf8");
  const packageMarker = content.match(/package-json-sha256:\s*([a-f0-9]+|missing)/)?.[1];
  const lockMarker = content.match(/pnpm-lock-sha256:\s*([a-f0-9]+|missing)/)?.[1];
  const workspaceMarker = content.match(/pnpm-workspace-sha256:\s*([a-f0-9]+|missing)/)?.[1];
  const policyMarker = content.match(/dependency-policy-sha256:\s*([a-f0-9]+|missing)/)?.[1];
  if (
    packageMarker !== packageHash ||
    lockMarker !== lockHash ||
    workspaceMarker !== workspaceHash ||
    policyMarker !== policyHash
  ) {
    console.error("Dependency status documentation is stale. Run pnpm deps:status and commit the result.");
    console.error(`package.json: document=${packageMarker || "missing"}, current=${packageHash}`);
    console.error(`pnpm-lock.yaml: document=${lockMarker || "missing"}, current=${lockHash}`);
    console.error(`${WORKSPACE_PATH}: document=${workspaceMarker || "missing"}, current=${workspaceHash}`);
    console.error(`${POLICY_PATH}: document=${policyMarker || "missing"}, current=${policyHash}`);
    return 1;
  }
  console.log(
    `Dependency status documentation matches package.json, pnpm-lock.yaml, ${WORKSPACE_PATH}, and ${POLICY_PATH}.`
  );
  return 0;
}

async function generateReport(packageHash, lockHash, workspaceHash, policyHash) {
  const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
  const workspaceConfig = readFileSync(WORKSPACE_PATH, "utf8");
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  const minimumReleaseAgeMinutes = parseMinimumReleaseAgeMinutes(workspaceConfig);
  if (/^minimumReleaseAgeExclude:/mu.test(workspaceConfig)) {
    throw new Error(`${WORKSPACE_PATH} must not bypass the minimum release age.`);
  }
  const evaluationClock = new Date().toISOString();
  const directRows = directDependencyRows(packageJson);
  const packageNames = [...new Set(directRows.map((row) => row.name))];

  const listResult = runPnpm(["list", "--depth", "0", "--json"]);
  const installedRecords = readListResult(listResult);
  const installed = new Map(
    Object.entries(installedRecords).map(([name, record]) => [name, parseVersion(record?.version)?.raw || ""])
  );

  const outdatedResult = runPnpm(["outdated", "--format", "json"]);
  const outdated = readOutdatedResult(outdatedResult);
  for (const [name, entry] of Object.entries(outdated)) {
    if (installed.has(name) && entry.current && installed.get(name) !== parseVersion(entry.current)?.raw) {
      throw new Error(
        `pnpm outdated current version for ${name} (${entry.current}) does not match pnpm list (${installed.get(name)}).`
      );
    }
  }

  const registryLatest = await lookupRegistryLatest(packageNames);
  const policyValidations = await validateCompatibilityPolicy({
    policy,
    directRows,
    installed: new Map(Object.entries(installedRecords)),
    registryLatest
  });
  const releaseAgePackageNames = packageNames.filter(
    (name) => installed.get(name) && installed.get(name) !== registryLatest.get(name) && !policyValidations.has(name)
  );
  const releaseMetadata = releaseAgePackageNames.length
    ? await lookupRegistryReleaseMetadata(releaseAgePackageNames)
    : { registryLatest: new Map(), versions: new Map(), releaseTimes: new Map() };
  for (const name of releaseAgePackageNames) {
    if (releaseMetadata.registryLatest.get(name) !== registryLatest.get(name)) {
      throw new Error(
        `Registry latest for ${name} changed while release metadata was being collected; rerun the check.`
      );
    }
  }

  const fullAudit = readAuditResult(runPnpm(["audit", "--json"]), "pnpm audit --json");
  const prodAudit = readAuditResult(runPnpm(["audit", "--prod", "--json"]), "pnpm audit --prod --json");

  const rows = directRows.map((direct) => {
    const installedVersion = installed.get(direct.name) || "";
    const latestVersion = registryLatest.get(direct.name) || "";
    const validation = policyValidations.get(direct.name);
    const classification = classifyDependencyStatus({
      manifestVersion: direct.specifier,
      installedVersion,
      registryLatest: latestVersion,
      compatibilityValidation: validation,
      registryVersions: releaseMetadata.versions.get(direct.name),
      releaseTimes: releaseMetadata.releaseTimes.get(direct.name),
      minimumReleaseAgeMinutes,
      now: evaluationClock
    });

    return {
      ...direct,
      installed: installedVersion || "—",
      ...classification
    };
  });
  rows.sort((left, right) => left.section.localeCompare(right.section) || left.name.localeCompare(right.name));

  const policyErrors = [...policyValidations]
    .filter(([, validation]) => !validation.valid)
    .map(([name, validation]) => `${name}: ${validation.errors.join("; ")}`);
  const enforcementFailures = rows.filter((row) => !ACCEPTED_DEPENDENCY_STATUSES.has(row.status));
  const auditFailures = [fullAudit, prodAudit].filter((audit) => audit.status !== "PASS");
  const acceptedCount = rows.length - enforcementFailures.length;
  const reportHash = createHash("sha256")
    .update(
      JSON.stringify({
        minimumReleaseAgeMinutes,
        rows: rows.map(
          ({
            name,
            section,
            specifier,
            installed,
            registryLatest: latest,
            newestEligibleStable,
            publishedAt,
            eligibleAt,
            status,
            reason
          }) => ({
            name,
            section,
            specifier,
            installed,
            registryLatest: latest,
            newestEligibleStable,
            publishedAt,
            eligibleAt,
            status,
            reason
          })
        ),
        fullAudit,
        prodAudit
      })
    )
    .digest("hex");
  const generatedAt = generatedAtForInputs(packageHash, lockHash, workspaceHash, policyHash, reportHash);
  const auditTable = markdownTable(
    ["Scope", "Status", "Low", "Moderate", "High", "Critical", "Exit code", "Error"],
    ["left", "left", "right", "right", "right", "right", "right", "left"],
    [
      [
        "Full tree",
        fullAudit.status,
        auditCell(fullAudit.low),
        auditCell(fullAudit.moderate),
        auditCell(fullAudit.high),
        auditCell(fullAudit.critical),
        auditCell(fullAudit.exit),
        markdownCell(fullAudit.error || "—")
      ],
      [
        "Production",
        prodAudit.status,
        auditCell(prodAudit.low),
        auditCell(prodAudit.moderate),
        auditCell(prodAudit.high),
        auditCell(prodAudit.critical),
        auditCell(prodAudit.exit),
        markdownCell(prodAudit.error || "—")
      ]
    ]
  );
  const dependencyTable = markdownTable(
    [
      "Package",
      "Section",
      "Manifest",
      "Installed",
      "Registry latest",
      "Newest eligible stable",
      "Published at",
      "Eligible at",
      "Status",
      "Reason"
    ],
    ["left", "left", "left", "left", "left", "left", "left", "left", "left", "left"],
    rows.map((row) => [
      `\`${markdownCell(row.name)}\``,
      row.section,
      `\`${markdownCell(row.specifier)}\``,
      `\`${markdownCell(row.installed)}\``,
      `\`${markdownCell(row.registryLatest)}\``,
      `\`${markdownCell(row.newestEligibleStable)}\``,
      markdownCell(row.publishedAt),
      markdownCell(row.eligibleAt),
      row.status,
      markdownCell(row.reason)
    ])
  );
  const lines = [
    "<!-- Generated by scripts/generate-dependency-status.mjs. Do not edit the matrix manually. -->",
    `<!-- package-json-sha256: ${packageHash} -->`,
    `<!-- pnpm-lock-sha256: ${lockHash} -->`,
    `<!-- pnpm-workspace-sha256: ${workspaceHash} -->`,
    `<!-- dependency-policy-sha256: ${policyHash} -->`,
    `<!-- report-data-sha256: ${reportHash} -->`,
    "",
    "# Dependency Status",
    "",
    "- Document status: active",
    "- Canonical: true",
    `- Generated at: ${generatedAt}`,
    `- Registry lookup: PASS (${packageNames.length} direct dependencies)`,
    `- Direct dependencies: ${rows.length}`,
    `- Registry latest, validated compatibility exceptions, or validated release-age holds: ${acceptedCount}`,
    "",
    "## Security audit",
    "",
    ...auditTable,
    "",
    "## Direct dependency matrix",
    "",
    ...dependencyTable,
    "",
    "## Interpretation",
    "",
    "- `Registry latest` means the installed stable version matches the registry `latest` dist-tag.",
    "- `Validated compatibility exception` means a machine-checked peer or runtime constraint blocks registry latest.",
    `- \`Validated release-age hold\` means registry latest is younger than the ${minimumReleaseAgeMinutes}-minute policy and the installed version is the newest eligible stable release.`,
    "- `Published at` and `Eligible at` describe registry latest when release-age evaluation is required.",
    "- Release-age holds expire automatically and fail enforcement as soon as registry latest becomes eligible.",
    "- A security audit status of `PASS` means the command succeeded and reported valid counts for every severity.",
    "- A security audit status of `ERROR` means the result could not be validated and is never interpreted as zero vulnerabilities.",
    "- Regenerate this document whenever package.json, pnpm-lock.yaml, pnpm-workspace.yaml, registry state, or config/dependency-policy.json changes.",
    ""
  ];

  if (!flags.has("--no-write") && !flags.has("--enforce-latest")) {
    writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
    console.log(`Updated ${OUTPUT_PATH}. Accepted direct dependencies: ${acceptedCount}/${rows.length}.`);
  } else {
    console.log(`Validated dependency status without writing. Accepted: ${acceptedCount}/${rows.length}.`);
  }

  if (policyErrors.length) {
    console.error("Compatibility policy validation failed:");
    for (const error of policyErrors) console.error(`- ${error}`);
  }
  if (auditFailures.length) {
    console.error(
      `Security audit did not pass: ${auditFailures.map((audit) => `${audit.status} (exit ${audit.exit ?? "none"})`).join(", ")}`
    );
  }
  if (flags.has("--enforce-latest") && enforcementFailures.length) {
    console.error(
      "Direct dependencies are not registry latest, a validated compatibility exception, or a validated release-age hold:"
    );
    for (const row of enforcementFailures) {
      console.error(
        `- ${row.name}: installed ${row.installed}; registry latest ${row.registryLatest}; status ${row.status}`
      );
    }
  }

  if (policyErrors.length || auditFailures.length || (flags.has("--enforce-latest") && enforcementFailures.length)) {
    process.exitCode = 1;
  }
}

async function main() {
  const packageHash = hashFile(PACKAGE_PATH);
  const lockHash = hashFile(LOCK_PATH);
  const workspaceHash = hashFile(WORKSPACE_PATH);
  const policyHash = hashFile(POLICY_PATH);
  if (flags.has("--check")) {
    process.exitCode = checkFreshness(packageHash, lockHash, workspaceHash, policyHash);
    return;
  }
  await generateReport(packageHash, lockHash, workspaceHash, policyHash);
}

try {
  await main();
} catch (error) {
  console.error(`Dependency status generation failed closed: ${summarizeError(error.message)}`);
  process.exitCode = 1;
}
