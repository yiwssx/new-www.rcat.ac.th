import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_IDENTITY = 5;
export const MAX_FAILURES_PER_IP = 20;
export const MAX_RATE_LIMIT_BUCKETS = 5000;

const MAX_CLIENT_IP_LENGTH = 64;
const MINIMUM_SECRET_LENGTH = 32;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
}

function readHeader(request, name) {
  const headers = request?.headers;

  if (typeof headers?.get === "function") {
    return headers.get(name) ?? "";
  }

  const value = headers?.[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "") : typeof value === "string" ? value : "";
}

function normalizePositiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizeNow(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError("login rate-limit time must be a non-negative finite number");
  }

  return Math.floor(value);
}

function requireSecret(secret) {
  const normalized = typeof secret === "string" ? secret.trim() : "";

  if (normalized.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("admin proxy session secret is not configured");
  }

  return normalized;
}

function makeRateLimitKey(secret, value) {
  return createHmac("sha256", requireSecret(secret)).update(value).digest("hex");
}

export function normalizeLegacyLoginEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";

  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : "";
}

export function getLegacyLoginClientIp(request) {
  for (const headerName of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"]) {
    const headerValue = readHeader(request, headerName);

    if (!headerValue) {
      continue;
    }

    const candidate = headerValue.split(",", 1)[0].trim();

    if (
      candidate.length === 0 ||
      candidate.length > MAX_CLIENT_IP_LENGTH ||
      hasControlCharacter(candidate) ||
      isIP(candidate) === 0
    ) {
      return "unknown";
    }

    return candidate.toLowerCase();
  }

  return "unknown";
}

export function createLegacyLoginRateLimitKeys({ email, request, secret }) {
  const clientIp = getLegacyLoginClientIp(request);
  const normalizedEmail = normalizeLegacyLoginEmail(email);

  return {
    identityKey: normalizedEmail ? makeRateLimitKey(secret, `identity:${normalizedEmail}|${clientIp}`) : null,
    ipKey: makeRateLimitKey(secret, `ip:${clientIp}`)
  };
}

export function createLegacyLoginRateLimiter(options = {}) {
  const windowMs = normalizePositiveInteger(options.windowMs, LOGIN_WINDOW_MS);
  const blockMs = normalizePositiveInteger(options.blockMs, LOGIN_BLOCK_MS);
  const maxFailuresPerIdentity = normalizePositiveInteger(options.maxFailuresPerIdentity, MAX_FAILURES_PER_IDENTITY);
  const maxFailuresPerIp = normalizePositiveInteger(options.maxFailuresPerIp, MAX_FAILURES_PER_IP);
  const maxBuckets = normalizePositiveInteger(options.maxBuckets, MAX_RATE_LIMIT_BUCKETS);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const buckets = new Map();

  function resolveNow(nowMs) {
    return normalizeNow(nowMs === undefined ? now() : nowMs);
  }

  function isExpired(bucket, nowMs) {
    if (bucket.blockedUntil > 0) {
      return bucket.blockedUntil <= nowMs;
    }

    return bucket.windowStartedAt + windowMs <= nowMs;
  }

  function pruneExpired(nowMs) {
    for (const [key, bucket] of buckets) {
      if (isExpired(bucket, nowMs)) {
        buckets.delete(key);
      }
    }
  }

  function evictOldest() {
    let oldestKey = null;
    let oldestTouchedAt = Number.POSITIVE_INFINITY;

    for (const [key, bucket] of buckets) {
      if (bucket.lastTouchedAt < oldestTouchedAt) {
        oldestKey = key;
        oldestTouchedAt = bucket.lastTouchedAt;
      }
    }

    if (oldestKey !== null) {
      buckets.delete(oldestKey);
    }
  }

  function ensureCapacity(nowMs) {
    pruneExpired(nowMs);

    while (buckets.size >= maxBuckets) {
      evictOldest();
    }
  }

  function keyEntries(keys) {
    const entries = [[keys.ipKey, maxFailuresPerIp]];

    if (keys.identityKey) {
      entries.push([keys.identityKey, maxFailuresPerIdentity]);
    }

    return entries;
  }

  function makeStatus(retryAfterMs) {
    const boundedRetryAfterMs = Math.min(blockMs, Math.max(0, retryAfterMs));

    return {
      blocked: boundedRetryAfterMs > 0,
      retryAfterSeconds: boundedRetryAfterMs > 0 ? Math.max(1, Math.ceil(boundedRetryAfterMs / 1000)) : 0
    };
  }

  function readStatus(keys, nowMs) {
    let retryAfterMs = 0;

    for (const [key] of keyEntries(keys)) {
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.lastTouchedAt = nowMs;
      }

      if (bucket?.blockedUntil > nowMs) {
        retryAfterMs = Math.max(retryAfterMs, bucket.blockedUntil - nowMs);
      }
    }

    return makeStatus(retryAfterMs);
  }

  function check(keys, nowMs) {
    const timestamp = resolveNow(nowMs);
    pruneExpired(timestamp);
    return readStatus(keys, timestamp);
  }

  function recordFailure(keys, nowMs) {
    const timestamp = resolveNow(nowMs);
    pruneExpired(timestamp);
    const existingStatus = readStatus(keys, timestamp);

    if (existingStatus.blocked) {
      return existingStatus;
    }

    for (const [key, maximumFailures] of keyEntries(keys)) {
      let bucket = buckets.get(key);

      if (!bucket) {
        ensureCapacity(timestamp);
        bucket = {
          blockedUntil: 0,
          failures: 0,
          lastTouchedAt: timestamp,
          windowStartedAt: timestamp
        };
        buckets.set(key, bucket);
      }

      bucket.failures += 1;
      bucket.lastTouchedAt = timestamp;

      if (bucket.failures >= maximumFailures) {
        bucket.blockedUntil = timestamp + blockMs;
      }
    }

    return readStatus(keys, timestamp);
  }

  function recordSuccess(keys, nowMs) {
    const timestamp = resolveNow(nowMs);
    pruneExpired(timestamp);

    if (keys.identityKey) {
      buckets.delete(keys.identityKey);
    }
  }

  function getSnapshotForTests(nowMs) {
    const timestamp = resolveNow(nowMs);
    pruneExpired(timestamp);

    return {
      buckets: [...buckets.entries()].map(([key, bucket]) => ({ key, ...bucket })),
      size: buckets.size
    };
  }

  return {
    check,
    getSnapshotForTests,
    recordFailure,
    recordSuccess
  };
}
