import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRAPH_VERSION = "v25.0";
const DEFAULT_LIMIT = 25;
const DEFAULT_CHUNK_DAYS = 30;
const ALLOWED_LIMITS = new Set([10, 25, 50]);
const BOOLEAN_FLAGS = new Set(["include-attachments"]);
const MINIMAL_GRAPH_FIELDS = ["id", "message", "story", "created_time", "permalink_url", "full_picture", "status_type"];
const ATTACHMENTS_GRAPH_FIELD = "attachments{media,type,url,subattachments}";
const NOOP_LOGGER = {
  log() {}
};

class FacebookApiRequestError extends Error {
  constructor(payload, token, limit) {
    super(createApiErrorMessage(payload, token));
    this.name = "FacebookApiRequestError";
    this.payload = maskSensitive(payload, token);
    this.code = payload?.error?.code;
    this.apiMessage = typeof payload?.error?.message === "string" ? payload.error.message : "";
    this.limit = limit;
    this.isReduceDataError = isReduceDataErrorPayload(payload);
  }
}

function parseCliArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }

    const key = arg.slice(2);

    if (BOOLEAN_FLAGS.has(key)) {
      parsed[key] = true;
      continue;
    }

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

function parsePositiveInteger(value, fallback, label) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function parseLimit(value) {
  const limit = parsePositiveInteger(value, DEFAULT_LIMIT, "--limit");

  if (!ALLOWED_LIMITS.has(limit)) {
    throw new Error("--limit must be one of: 10, 25, 50");
  }

  return limit;
}

function parseChunkDays(value) {
  return parsePositiveInteger(value, DEFAULT_CHUNK_DAYS, "--chunk-days");
}

function parseDateBoundary(value, label) {
  const dateText = requireNonEmpty(value, label);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateText)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }

  const [year, month, day] = dateText.split("-").map(Number);
  const dayStartTimestamp = Date.UTC(year, month - 1, day);

  if (!Number.isFinite(dayStartTimestamp) || formatDate(dayStartTimestamp) !== dateText) {
    throw new Error(`${label} must be a valid date`);
  }

  return {
    text: dateText,
    dayStartTimestamp
  };
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function unixSeconds(timestamp) {
  return Math.floor(timestamp / 1000).toString();
}

function createGraphFields(includeAttachments) {
  return includeAttachments
    ? [...MINIMAL_GRAPH_FIELDS.slice(0, 6), ATTACHMENTS_GRAPH_FIELD, MINIMAL_GRAPH_FIELDS[6]].join(",")
    : MINIMAL_GRAPH_FIELDS.join(",");
}

function createChunk(startDayTimestamp, endDayTimestamp) {
  return {
    since: {
      text: formatDate(startDayTimestamp),
      timestamp: startDayTimestamp
    },
    until: {
      text: formatDate(endDayTimestamp),
      timestamp: endDayTimestamp + DAY_MS - 1
    },
    startDayTimestamp,
    endDayTimestamp
  };
}

function createDateChunks(since, until, chunkDays) {
  if (since.dayStartTimestamp > until.dayStartTimestamp) {
    throw new Error("--since must be before or equal to --until");
  }

  const chunks = [];
  let cursor = since.dayStartTimestamp;

  while (cursor <= until.dayStartTimestamp) {
    const chunkEnd = Math.min(cursor + chunkDays * DAY_MS, until.dayStartTimestamp);

    chunks.push(createChunk(cursor, chunkEnd));
    cursor = chunkEnd + DAY_MS;
  }

  return chunks;
}

function splitChunk(chunk) {
  if (chunk.startDayTimestamp >= chunk.endDayTimestamp) {
    return null;
  }

  const daysInRange = Math.floor((chunk.endDayTimestamp - chunk.startDayTimestamp) / DAY_MS);
  const firstEnd = chunk.startDayTimestamp + Math.floor(daysInRange / 2) * DAY_MS;
  const secondStart = firstEnd + DAY_MS;

  return [createChunk(chunk.startDayTimestamp, firstEnd), createChunk(secondStart, chunk.endDayTimestamp)];
}

function buildInitialPostsUrl({ graphVersion, pageId, token, since, until, limit, fields }) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${pageId}/posts`);

  url.searchParams.set("fields", fields);
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

function isReduceDataErrorPayload(payload) {
  const error = payload?.error;
  const message = typeof error?.message === "string" ? error.message : "";

  return error?.code === 1 && /reduce|amount of data/iu.test(message);
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

function nextSmallerLimit(limit) {
  if (limit > 25) {
    return 25;
  }

  if (limit > 10) {
    return 10;
  }

  return null;
}

function createChunkError(chunk, error, limit) {
  return {
    since: chunk.since.text,
    until: chunk.until.text,
    limit,
    code: error.code ?? null,
    message: error.apiMessage || error.message,
    payload: error.payload ?? null
  };
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {
      error: {
        message: `Facebook API returned non-JSON response with HTTP status ${response.status}`
      }
    };
  }
}

async function fetchChunkAttempt({ chunk, fetchImpl, fields, graphVersion, limit, pageId, token }) {
  const posts = [];
  let nextUrl = buildInitialPostsUrl({
    graphVersion,
    pageId,
    token,
    since: chunk.since,
    until: chunk.until,
    limit,
    fields
  });

  while (nextUrl) {
    const response = await fetchImpl(nextUrl);
    const payload = await readJsonResponse(response);

    if (!response.ok || payload?.error) {
      throw new FacebookApiRequestError(payload, token, limit);
    }

    if (Array.isArray(payload.data)) {
      posts.push(...payload.data.filter((post) => postIsInRange(post, chunk.since, chunk.until)));
    }

    nextUrl = typeof payload.paging?.next === "string" && payload.paging.next.trim() !== "" ? payload.paging.next : "";
  }

  return posts;
}

async function fetchChunkWithRetries(context) {
  try {
    return {
      posts: await fetchChunkAttempt(context),
      errors: []
    };
  } catch (error) {
    if (!(error instanceof FacebookApiRequestError) || !error.isReduceDataError) {
      throw error;
    }

    const smallerLimit = nextSmallerLimit(context.limit);

    if (smallerLimit) {
      return fetchChunkWithRetries({
        ...context,
        limit: smallerLimit
      });
    }

    const splitChunks = splitChunk(context.chunk);

    if (splitChunks) {
      const first = await fetchChunkWithRetries({
        ...context,
        chunk: splitChunks[0]
      });
      const second = await fetchChunkWithRetries({
        ...context,
        chunk: splitChunks[1]
      });

      return {
        posts: [...first.posts, ...second.posts],
        errors: [...first.errors, ...second.errors]
      };
    }

    return {
      posts: [],
      errors: [createChunkError(context.chunk, error, context.limit)]
    };
  }
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
  const until = parseDateBoundary(options?.until, "--until");
  const chunkDays = parseChunkDays(options?.chunkDays);
  const limit = parseLimit(options?.limit);
  const includeAttachments = Boolean(options?.includeAttachments);
  const fields = createGraphFields(includeAttachments);
  const fieldsMode = includeAttachments ? "attachments" : "minimal";
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const now = options?.now ?? (() => new Date());
  const logger = options?.logger ?? NOOP_LOGGER;

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this Node runtime");
  }

  const postsById = new Map();
  const errors = [];
  const chunks = createDateChunks(since, until, chunkDays);

  for (const chunk of chunks) {
    logger.log(`Exporting chunk ${chunk.since.text} to ${chunk.until.text} ...`);

    const result = await fetchChunkWithRetries({
      chunk,
      fetchImpl,
      fields,
      graphVersion,
      limit,
      pageId,
      token
    });

    result.posts.forEach((post) => {
      if (typeof post?.id === "string" && !postsById.has(post.id)) {
        postsById.set(post.id, post);
      }
    });
    errors.push(...result.errors);

    logger.log(`Fetched ${result.posts.length} posts`);
  }

  return {
    source: "facebook-page",
    pageId,
    since: since.text,
    until: until.text,
    chunkDays,
    generatedAt: now().toISOString(),
    fieldsMode,
    posts: Array.from(postsById.values()),
    errors
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
    chunkDays: args["chunk-days"],
    limit: args.limit,
    includeAttachments: Boolean(args["include-attachments"]),
    logger: console
  });

  await writeJson(outputPath, result);
  console.log(
    `Exported ${result.posts.length} Facebook post(s) with ${result.errors.length} chunk error(s) to ${outputPath}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
