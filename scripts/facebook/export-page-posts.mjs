import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_GRAPH_VERSION = "v25.0";
const DEFAULT_LIMIT = 100;
const GRAPH_FIELDS = [
  "id",
  "message",
  "story",
  "created_time",
  "permalink_url",
  "full_picture",
  "attachments{media,type,url,subattachments}",
  "status_type"
].join(",");

function parseCliArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function requireNonEmpty(value, label, thaiLabel = label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required / ต้องตั้งค่า ${thaiLabel}`);
  }

  return value.trim();
}

function normalizeGraphVersion(value) {
  const version = typeof value === "string" && value.trim() !== "" ? value.trim() : DEFAULT_GRAPH_VERSION;

  return version.startsWith("v") ? version : `v${version}`;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--limit must be a positive integer");
  }

  return parsed;
}

function parseDateBoundary(value, label, endOfDay = false) {
  const dateText = requireNonEmpty(value, label);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateText)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }

  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const timestamp = Date.parse(`${dateText}${suffix}`);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be a valid date`);
  }

  return {
    text: dateText,
    timestamp
  };
}

function unixSeconds(timestamp) {
  return Math.floor(timestamp / 1000).toString();
}

function buildInitialPostsUrl({ graphVersion, pageId, token, since, until, limit }) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${pageId}/posts`);

  url.searchParams.set("fields", GRAPH_FIELDS);
  url.searchParams.set("since", unixSeconds(since.timestamp));
  url.searchParams.set("until", unixSeconds(until.timestamp));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", token);

  return url.toString();
}

function maskSensitive(value, token) {
  if (Array.isArray(value)) {
    return value.map((entry) => maskSensitive(entry, token));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /token|access_token|secret/iu.test(key) ? "[redacted]" : maskSensitive(entry, token)
      ])
    );
  }

  if (typeof value === "string" && token) {
    return value.replaceAll(token, "[redacted]");
  }

  return value;
}

function createApiErrorMessage(payload, token) {
  const sanitizedPayload = maskSensitive(payload, token);
  const error = payload?.error;
  const code = error?.code;
  const message = typeof error?.message === "string" ? error.message : "";
  const permissionLike =
    code === 10 || code === 190 || code === 200 || /permission|permissions|OAuth|access token/iu.test(message);
  const heading = permissionLike
    ? "Facebook API permission/auth error. API payload:"
    : "Facebook API request failed. API payload:";

  return `${heading}\n${JSON.stringify(sanitizedPayload, null, 2)}`;
}

function postIsInRange(post, since, until) {
  const timestamp = Date.parse(post?.created_time ?? "");

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return timestamp >= since.timestamp && timestamp <= until.timestamp;
}

export async function exportFacebookPagePosts(options) {
  const token = requireNonEmpty(
    options?.token,
    "META_PAGE_ACCESS_TOKEN",
    "META_PAGE_ACCESS_TOKEN สำหรับ Facebook Page access token"
  );
  const pageId = requireNonEmpty(options?.pageId, "META_PAGE_ID", "META_PAGE_ID");
  const graphVersion = normalizeGraphVersion(options?.graphVersion);
  const since = parseDateBoundary(options?.since, "--since");
  const until = parseDateBoundary(options?.until, "--until", true);
  const limit = parsePositiveInteger(options?.limit, DEFAULT_LIMIT);
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const now = options?.now ?? (() => new Date());

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this Node runtime");
  }

  const posts = [];
  let nextUrl = buildInitialPostsUrl({ graphVersion, pageId, token, since, until, limit });

  while (nextUrl) {
    const response = await fetchImpl(nextUrl);
    const payload = await response.json();

    if (!response.ok || payload?.error) {
      throw new Error(createApiErrorMessage(payload, token));
    }

    if (Array.isArray(payload.data)) {
      posts.push(...payload.data.filter((post) => postIsInRange(post, since, until)));
    }

    nextUrl = typeof payload.paging?.next === "string" && payload.paging.next.trim() !== "" ? payload.paging.next : "";
  }

  return {
    source: "facebook-page",
    pageId,
    since: since.text,
    until: until.text,
    generatedAt: now().toISOString(),
    posts
  };
}

async function writeJson(outputPath, payload) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  const outputPath = requireNonEmpty(args.output, "--output");
  const result = await exportFacebookPagePosts({
    token: process.env.META_PAGE_ACCESS_TOKEN,
    pageId: process.env.META_PAGE_ID,
    graphVersion: process.env.META_GRAPH_VERSION,
    since: args.since,
    until: args.until,
    limit: args.limit
  });

  await writeJson(outputPath, result);
  console.log(`Exported ${result.posts.length} Facebook post(s) to ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
