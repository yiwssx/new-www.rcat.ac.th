import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const GIB = 1024 ** 3;
const HOUR = 60 * 60 * 1000;
const TRIGGER_BYTES = 8 * GIB;
const TARGET_BYTES = 6 * GIB;
const GRACE_HOURS = 2;
const MAX_DELETES = 40;

function cacheGroup(cache) {
  const key = cache.key;
  if (key.startsWith("codeql-overlay-base-database-")) {
    const language = key.match(/-(javascript|typescript|python|java|csharp|cpp|go|ruby|swift|rust)-/i)?.[1] ?? "other";
    return `codeql:${language.toLowerCase()}:${cache.ref}`;
  }
  if (key.startsWith("node-cache-") && key.includes("-pnpm-")) return `pnpm:${cache.ref}`;
  return null;
}

function newestFirst(a, b) {
  return (
    Date.parse(b.last_accessed_at) - Date.parse(a.last_accessed_at) ||
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    b.id - a.id
  );
}

export function planCacheCleanup(caches, options = {}) {
  if (!Array.isArray(caches)) throw new Error("Expected a complete GitHub Actions cache list");
  const now = options.now ?? Date.now();
  const triggerBytes = options.triggerBytes ?? TRIGGER_BYTES;
  const targetBytes = options.targetBytes ?? TARGET_BYTES;
  const graceMs = (options.graceHours ?? GRACE_HOURS) * HOUR;
  const maxDeletes = options.maxDeletes ?? MAX_DELETES;
  if (targetBytes >= triggerBytes) throw new Error("Target must be below trigger");

  const groups = new Map();
  let totalBytes = 0;
  for (const cache of caches) {
    if (
      !Number.isSafeInteger(cache.id) ||
      cache.id <= 0 ||
      !Number.isSafeInteger(cache.size_in_bytes) ||
      cache.size_in_bytes < 0 ||
      typeof cache.key !== "string" ||
      typeof cache.ref !== "string" ||
      !Number.isFinite(Date.parse(cache.created_at)) ||
      !Number.isFinite(Date.parse(cache.last_accessed_at))
    ) {
      throw new Error("Invalid Actions cache record; refusing cleanup");
    }
    totalBytes += cache.size_in_bytes;
    const group = cacheGroup(cache);
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(cache);
  }

  const protectedIds = new Set();
  for (const [group, entries] of groups) {
    entries.sort(newestFirst);
    const keep = group.startsWith("codeql:") ? 3 : 2;
    entries.slice(0, keep).forEach((entry) => protectedIds.add(entry.id));
  }

  const candidates = [...groups.values()]
    .flat()
    .filter(
      (cache) =>
        !protectedIds.has(cache.id) &&
        now - Date.parse(cache.last_accessed_at) >= graceMs &&
        now - Date.parse(cache.created_at) >= graceMs
    )
    .sort((a, b) => {
      const aCodeql = a.key.startsWith("codeql-");
      const bCodeql = b.key.startsWith("codeql-");
      return (
        Number(bCodeql) - Number(aCodeql) ||
        Date.parse(a.last_accessed_at) - Date.parse(b.last_accessed_at) ||
        b.size_in_bytes - a.size_in_bytes
      );
    });

  const selected = [];
  let projectedBytes = totalBytes;
  if (totalBytes >= triggerBytes) {
    for (const cache of candidates) {
      if (projectedBytes <= targetBytes || selected.length >= maxDeletes) break;
      selected.push(cache);
      projectedBytes -= cache.size_in_bytes;
    }
  }
  return {
    totalBytes,
    projectedBytes,
    selected,
    knownCount: [...groups.values()].reduce((count, entries) => count + entries.length, 0),
    protectedCount: protectedIds.size,
    thresholdReached: totalBytes >= triggerBytes
  };
}

async function githubRequest(path, token, method = "GET") {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(30000)
  });
  if (method === "DELETE" && response.status === 204) return null;
  if (!response.ok) throw new Error(`GitHub cache API ${method} returned HTTP ${response.status}`);
  return response.json();
}

async function listCaches(repository, token) {
  const caches = [];
  for (let page = 1; page <= 20; page++) {
    const response = await githubRequest(`/repos/${repository}/actions/caches?per_page=100&page=${page}`, token);
    if (!Array.isArray(response.actions_caches) || !Number.isSafeInteger(response.total_count)) {
      throw new Error("GitHub cache API response is incomplete");
    }
    caches.push(...response.actions_caches);
    if (caches.length >= response.total_count) return caches;
    if (response.actions_caches.length === 0) throw new Error("GitHub cache pagination ended unexpectedly");
  }
  throw new Error("More than 2,000 cache entries; refuse partial cleanup");
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const dryRun = process.env.DRY_RUN === "true";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "") || !token) {
    throw new Error("Missing validated repository or GitHub token");
  }
  if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Cache cleanup only runs on main");
  const caches = await listCaches(repository, token);
  const plan = planCacheCleanup(caches);
  const gib = (bytes) => (bytes / GIB).toFixed(2);
  console.log(
    `Cache audit: ${caches.length} entries; ${gib(plan.totalBytes)} GiB; recognized=${plan.knownCount}; protected=${plan.protectedCount}; ` +
      `delete=${plan.selected.length}; projected=${gib(plan.projectedBytes)} GiB; dry_run=${dryRun}`
  );
  const summary = [
    "## GitHub Actions cache maintenance",
    `- Mode: ${dryRun ? "DRY RUN" : "APPLY"}`,
    `- Before: ${caches.length} entries, ${gib(plan.totalBytes)} GiB`,
    `- Recognized / preserved newest: ${plan.knownCount} / ${plan.protectedCount}`,
    `- Trigger: ${gib(TRIGGER_BYTES)} GiB; target: ${gib(TARGET_BYTES)} GiB`,
    `- Selected: ${plan.selected.length} entries, ${gib(plan.totalBytes - plan.projectedBytes)} GiB`,
    `- Projected after deletion: ${gib(plan.projectedBytes)} GiB`,
    "- Only CodeQL overlay and pnpm caches considered; other keys are never removed.",
    "- Every family/ref keeps its newest entries; recently used caches are protected.",
    ""
  ];
  let deleted = 0;
  for (const cache of plan.selected) {
    console.log(`${dryRun ? "WOULD_DELETE" : "DELETE"} cache ID=${cache.id} bytes=${cache.size_in_bytes}`);
    if (!dryRun) {
      await githubRequest(`/repos/${repository}/actions/caches/${cache.id}`, token, "DELETE");
      deleted++;
    }
  }
  summary.push(`- Actually deleted: ${deleted} entries`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
