import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const configFile = fileURLToPath(new URL("../../config/ci-impact-map.json", import.meta.url));

export const defaultImpactMap = JSON.parse(readFileSync(configFile, "utf8"));

function normalizePath(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..") ||
    /[\0\r\n]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function resolveChangedPaths(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const paths = new Set();

  for (const entry of entries) {
    if (typeof entry === "string") {
      const path = normalizePath(entry);
      if (!path) return null;
      paths.add(path);
      continue;
    }
    if (!entry || typeof entry !== "object") return null;
    const status = entry.status ?? "modified";
    if (!["added", "modified", "deleted", "renamed"].includes(status)) return null;
    const path = normalizePath(entry.path);
    if (!path) return null;
    paths.add(path);
    if (status === "renamed") {
      const previousPath = normalizePath(entry.previousPath);
      if (!previousPath) return null;
      paths.add(previousPath);
    }
  }
  return [...paths].sort();
}

function validateMap(map) {
  if (
    !map ||
    map.version !== 1 ||
    !Array.isArray(map.lanes) ||
    map.lanes.length === 0 ||
    !Array.isArray(map.rules)
  ) {
    throw new Error("Invalid CI impact map");
  }
  for (const rule of map.rules) {
    if (
      !rule ||
      !rule.id ||
      (!Array.isArray(rule.exact) && !Array.isArray(rule.prefix)) ||
      (!rule.full && !Array.isArray(rule.lanes))
    ) {
      throw new Error("Invalid CI impact rule");
    }
    if (!rule.full && rule.lanes.some((lane) => !map.lanes.includes(lane))) {
      throw new Error("Unknown lane in CI impact map");
    }
  }
}

function matches(path, rule) {
  return rule.exact?.includes(path) || rule.prefix?.some((prefix) => path.startsWith(prefix));
}

function fullPlan(map, paths, reason) {
  return {
    version: map.version,
    mode: "full",
    gateReady: false,
    changedPaths: paths ?? [],
    areas: ["all"],
    requiredLanes: [...map.lanes],
    skippedLanes: [],
    reasons: [reason]
  };
}

/**
 * Classify explicit changed paths conservatively. This is a planning primitive,
 * NOT a release gate: P2 must verify the Git diff, base ref, and integrated tree.
 */
export function createImpactPlan(entries, map = defaultImpactMap) {
  validateMap(map);
  const paths = resolveChangedPaths(entries);
  if (!paths) return fullPlan(map, [], "empty-or-invalid-change-set");

  const lanes = new Set(["static-quality"]);
  const areas = new Set();
  const reasons = [];
  for (const path of paths) {
    const rule = map.rules.find((candidate) => matches(path, candidate));
    if (!rule) return fullPlan(map, paths, `unclassified-path:${path}`);
    if (rule.full) return fullPlan(map, paths, `wide-impact:${rule.id}:${path}`);
    for (const lane of rule.lanes) lanes.add(lane);
    for (const area of rule.areas ?? []) areas.add(area);
    reasons.push(`${path}:${rule.id}`);
  }

  return {
    version: map.version,
    mode: "affected",
    gateReady: false,
    changedPaths: paths,
    areas: [...areas].sort(),
    requiredLanes: map.lanes.filter((lane) => lanes.has(lane)),
    skippedLanes: map.lanes.filter((lane) => !lanes.has(lane)),
    reasons
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1].startsWith("/") ? "" : process.cwd() + "/"}${process.argv[1]}`))) {
  const args = process.argv.slice(2);
  if (args[0] !== "--files") {
    console.error("Usage: node scripts/ci/impact-plan.mjs --files <changed-file> [...]");
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify(createImpactPlan(args.slice(1)), null, 2));
  }
}
