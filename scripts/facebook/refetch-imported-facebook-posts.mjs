import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { flattenWranglerRows, isFacebookImportRow } from "./reclassify-facebook-imports.mjs";

const DEFAULT_GRAPH_VERSION = "v25.0";
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_ATTEMPTS = 3;
const GRAPH_FIELDS = [
  "id",
  "message",
  "story",
  "created_time",
  "updated_time",
  "permalink_url",
  "status_type",
  "full_picture"
].join(",");
const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_GRAPH_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`Unknown positional argument: ${arg}`);

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);

    result[key] = value;
    index += 1;
  }

  return result;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function positiveInteger(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function normalizeGraphVersion(value) {
  const version = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_GRAPH_VERSION;
  return version.startsWith("v") ? version : `v${version}`;
}

export function sourceIdentityFromImportRow(row) {
  if (!isFacebookImportRow(row)) return null;

  const candidates = [String(row?.id ?? ""), String(row?.slug ?? "")];
  const patterns = [/^facebook-post-(\d+)-(\d+)$/u, /^facebook-(\d+)-(\d+)$/u];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      const match = candidate.match(pattern);
      if (match) {
        return {
          pageId: match[1],
          postId: match[2],
          graphId: `${match[1]}_${match[2]}`,
          sanitizedId: `${match[1]}-${match[2]}`
        };
      }
    }
  }

  return null;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTransientFailure(response, payload) {
  const code = Number(payload?.error?.code);
  return TRANSIENT_HTTP_STATUSES.has(response.status) || TRANSIENT_GRAPH_CODES.has(code);
}

function createFailure(row, identity, response, payload, reason = "graph-fetch-failed") {
  return {
    id: String(row?.id ?? ""),
    slug: String(row?.slug ?? ""),
    graphId: identity?.graphId ?? "",
    reason,
    status: Number(response?.status ?? 0) || null,
    code: payload?.error?.code ?? null,
    message: String(payload?.error?.message ?? reason)
  };
}

async function fetchOne({ row, identity, token, graphVersion, fetchImpl, maxAttempts, sleepImpl }) {
  if (!identity) {
    return {
      post: null,
      failure: createFailure(row, null, null, null, "unresolvable-facebook-import-id")
    };
  }

  const url = new URL(`https://graph.facebook.com/${graphVersion}/${identity.graphId}`);
  url.searchParams.set("fields", GRAPH_FIELDS);
  url.searchParams.set("access_token", token);

  let lastResponse = null;
  let lastPayload = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url);
    const payload = await response.json().catch(() => ({}));
    lastResponse = response;
    lastPayload = payload;

    if (response.ok && payload?.id) {
      return { post: payload, failure: null };
    }

    if (attempt < maxAttempts && isTransientFailure(response, payload)) {
      await sleepImpl(250 * 2 ** (attempt - 1));
      continue;
    }

    break;
  }

  return {
    post: null,
    failure: createFailure(row, identity, lastResponse, lastPayload)
  };
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

export async function refetchImportedFacebookPosts(options) {
  const token = requireText(options?.token, "META_PAGE_ACCESS_TOKEN");
  const graphVersion = normalizeGraphVersion(options?.graphVersion);
  const concurrency = positiveInteger(options?.concurrency, DEFAULT_CONCURRENCY, "concurrency");
  const maxAttempts = positiveInteger(options?.maxAttempts, DEFAULT_MAX_ATTEMPTS, "maxAttempts");
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const sleepImpl = options?.sleepImpl ?? sleep;
  const rows = flattenWranglerRows(options?.d1Payload).filter(isFacebookImportRow);

  if (typeof fetchImpl !== "function") throw new Error("fetch is not available in this Node runtime");
  if (rows.length === 0) throw new Error("No facebook-import rows were found in the D1 payload");

  const identities = rows.map((row) => sourceIdentityFromImportRow(row));
  const uniquePageIds = [...new Set(identities.filter(Boolean).map((identity) => identity.pageId))];

  const results = await mapConcurrent(rows, concurrency, (row, index) =>
    fetchOne({
      row,
      identity: identities[index],
      token,
      graphVersion,
      fetchImpl,
      maxAttempts,
      sleepImpl
    })
  );

  const posts = [];
  const failures = [];

  for (const result of results) {
    if (result.post) posts.push(result.post);
    if (result.failure) failures.push(result.failure);
  }

  return {
    source: "facebook-import-targeted-refetch",
    graphVersion,
    generatedAt: new Date().toISOString(),
    requested: rows.length,
    recovered: posts.length,
    unavailable: failures.length,
    pageIds: uniquePageIds,
    posts,
    errors: [],
    targetedRecovery: {
      requested: rows.length,
      recovered: posts.length,
      failures
    }
  };
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const d1Path = requireText(args["d1-json"], "--d1-json");
  const outputPath = requireText(args.output, "--output");
  const d1Payload = JSON.parse(await readFile(d1Path, "utf8"));
  const result = await refetchImportedFacebookPosts({
    d1Payload,
    token: process.env.META_PAGE_ACCESS_TOKEN,
    graphVersion: process.env.META_GRAPH_VERSION,
    concurrency: args.concurrency,
    maxAttempts: args["max-attempts"]
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    `Targeted facebook-import refetch: requested ${result.requested}, recovered ${result.recovered}, unavailable ${result.unavailable}.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
