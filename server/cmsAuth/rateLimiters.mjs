import { createHmac } from "node:crypto";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IDENTIFIER = 5;
const MAX_FAILURES_PER_IP = 20;
export const MAX_RATE_LIMIT_BUCKETS = 5000;

function rateLimitKey(secret, value) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createCmsLoginRateLimitKeys({ identifier, clientIp, secret }) {
  return {
    identifierKey: identifier ? rateLimitKey(secret, `cms-identifier:${identifier}|${clientIp}`) : null,
    ipKey: rateLimitKey(secret, `cms-ip:${clientIp}`)
  };
}

export function createCmsLoginRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? LOGIN_WINDOW_MS;
  const blockMs = options.blockMs ?? LOGIN_BLOCK_MS;
  const identifierLimit = options.identifierLimit ?? MAX_FAILURES_PER_IDENTIFIER;
  const ipLimit = options.ipLimit ?? MAX_FAILURES_PER_IP;
  const maximumBuckets = options.maximumBuckets ?? MAX_RATE_LIMIT_BUCKETS;
  const buckets = new Map();

  function entries(keys) {
    return keys.identifierKey
      ? [
          [keys.ipKey, ipLimit],
          [keys.identifierKey, identifierLimit]
        ]
      : [[keys.ipKey, ipLimit]];
  }

  function prune(nowMs) {
    for (const [key, bucket] of buckets) {
      const expiresAt = bucket.blockedUntil || bucket.windowStartedAt + windowMs;

      if (expiresAt <= nowMs) {
        buckets.delete(key);
      }
    }
  }

  function ensureCapacity(nowMs) {
    prune(nowMs);

    while (buckets.size >= maximumBuckets) {
      let oldestKey;
      let oldestTouchedAt = Number.POSITIVE_INFINITY;

      for (const [key, bucket] of buckets) {
        if (bucket.lastTouchedAt < oldestTouchedAt) {
          oldestKey = key;
          oldestTouchedAt = bucket.lastTouchedAt;
        }
      }

      if (oldestKey === undefined) {
        break;
      }

      buckets.delete(oldestKey);
    }
  }

  function check(keys, nowMs) {
    prune(nowMs);
    let retryAfterMs = 0;

    for (const [key] of entries(keys)) {
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.lastTouchedAt = nowMs;
        retryAfterMs = Math.max(retryAfterMs, bucket.blockedUntil - nowMs);
      }
    }

    return {
      blocked: retryAfterMs > 0,
      retryAfterSeconds: retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0
    };
  }

  function recordFailure(keys, nowMs) {
    const existing = check(keys, nowMs);

    if (existing.blocked) {
      return existing;
    }

    for (const [key, limit] of entries(keys)) {
      let bucket = buckets.get(key);

      if (!bucket) {
        ensureCapacity(nowMs);
        bucket = { failures: 0, blockedUntil: 0, windowStartedAt: nowMs, lastTouchedAt: nowMs };
        buckets.set(key, bucket);
      }

      bucket.failures += 1;
      bucket.lastTouchedAt = nowMs;

      if (bucket.failures >= limit) {
        bucket.blockedUntil = nowMs + blockMs;
      }
    }

    return check(keys, nowMs);
  }

  function recordSuccess(keys, nowMs) {
    prune(nowMs);

    if (keys.identifierKey) {
      buckets.delete(keys.identifierKey);
    }
  }

  return { check, recordFailure, recordSuccess };
}

export function createCmsLifecycleRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const blockMs = options.blockMs ?? 15 * 60 * 1000;
  const attemptLimit = options.attemptLimit ?? 30;
  const failureLimit = options.failureLimit ?? 10;
  const maximumBuckets = options.maximumBuckets ?? MAX_RATE_LIMIT_BUCKETS;
  const buckets = new Map();

  function prune(nowMs) {
    for (const [key, bucket] of buckets) {
      const expiresAt = bucket.blockedUntil || bucket.windowStartedAt + windowMs;

      if (expiresAt <= nowMs) {
        buckets.delete(key);
      }
    }
  }

  function ensureCapacity(nowMs) {
    prune(nowMs);

    while (buckets.size >= maximumBuckets) {
      let oldestKey;
      let oldestTouchedAt = Number.POSITIVE_INFINITY;

      for (const [key, bucket] of buckets) {
        if (bucket.lastTouchedAt < oldestTouchedAt) {
          oldestKey = key;
          oldestTouchedAt = bucket.lastTouchedAt;
        }
      }

      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
  }

  function status(keys, nowMs) {
    prune(nowMs);
    let retryAfterMs = 0;

    for (const key of [keys.attemptKey, keys.failureKey].filter(Boolean)) {
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.lastTouchedAt = nowMs;
        retryAfterMs = Math.max(retryAfterMs, bucket.blockedUntil - nowMs);
      }
    }

    return {
      blocked: retryAfterMs > 0,
      retryAfterSeconds: retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0
    };
  }

  function increment(key, limit, nowMs) {
    if (!key) return;
    let bucket = buckets.get(key);

    if (!bucket) {
      ensureCapacity(nowMs);
      bucket = { count: 0, blockedUntil: 0, windowStartedAt: nowMs, lastTouchedAt: nowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    bucket.lastTouchedAt = nowMs;

    if (bucket.count > limit) {
      bucket.blockedUntil = nowMs + blockMs;
    }
  }

  function recordAttempt(keys, nowMs) {
    increment(keys.attemptKey, attemptLimit, nowMs);
    return status(keys, nowMs);
  }

  function recordFailure(keys, nowMs) {
    increment(keys.failureKey, failureLimit, nowMs);
    return status(keys, nowMs);
  }

  return { check: status, recordAttempt, recordFailure };
}

export function createCmsLifecycleRateLimitKeys({ clientIp, secret, withFailure }) {
  return {
    attemptKey: rateLimitKey(secret, `cms-lifecycle-attempt:${clientIp}`),
    failureKey: withFailure ? rateLimitKey(secret, `cms-lifecycle-failure:${clientIp}`) : null
  };
}
