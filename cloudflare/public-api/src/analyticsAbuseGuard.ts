import type { Env } from "./env";
import { requireD1Database } from "./db/documentsRepository";

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT = 120;

export class PublicAnalyticsRateLimitExceeded extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("public analytics rate limit exceeded");
    this.name = "PublicAnalyticsRateLimitExceeded";
  }
}

export class PublicAnalyticsRateLimitSchemaMissing extends Error {
  constructor() {
    super("public analytics rate limit schema is missing");
    this.name = "PublicAnalyticsRateLimitSchemaMissing";
  }
}

function getClientIp(request: Request) {
  return (request.headers.get("CF-Connecting-IP") || "").trim().slice(0, 80);
}

async function hashBucketKey(scope: string, ip: string, bucket: number) {
  const bytes = new TextEncoder().encode(`${scope}:${bucket}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `rl_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40)}`;
}

function isMissingRateLimitSchema(error: unknown) {
  return (
    error instanceof Error &&
    /(?:no such table|missing).*public_write_rate_limits|public_write_rate_limits.*(?:not found|missing)/i.test(
      error.message
    )
  );
}

export async function enforcePublicAnalyticsRateLimit(
  request: Request,
  env: Env,
  input: { scope: string; limit?: number; now?: Date }
) {
  const ip = getClientIp(request);

  // Cloudflare supplies CF-Connecting-IP in production. Tests and local tooling may not.
  if (!ip) {
    return;
  }

  const db = requireD1Database(env);
  const now = input.now ?? new Date();
  const bucket = Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS);
  const bucketKey = await hashBucketKey(input.scope, ip, bucket);
  const expiresAt = new Date((bucket + 2) * RATE_LIMIT_WINDOW_MS).toISOString();
  const limit = Math.max(1, Math.floor(input.limit ?? DEFAULT_RATE_LIMIT));

  try {
    await db
      .prepare(
        `INSERT INTO public_write_rate_limits (bucket_key, request_count, expires_at)
         VALUES (?, 1, ?)
         ON CONFLICT(bucket_key) DO UPDATE SET
           request_count = public_write_rate_limits.request_count + 1,
           expires_at = excluded.expires_at`
      )
      .bind(bucketKey, expiresAt)
      .run();

    const row = await db
      .prepare("SELECT request_count FROM public_write_rate_limits WHERE bucket_key = ? LIMIT 1")
      .bind(bucketKey)
      .first<{ request_count: number }>();

    if (Math.max(0, Number(row?.request_count) || 0) > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil(((bucket + 1) * RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000));
      throw new PublicAnalyticsRateLimitExceeded(retryAfterSeconds);
    }
  } catch (error) {
    if (error instanceof PublicAnalyticsRateLimitExceeded) {
      throw error;
    }

    if (isMissingRateLimitSchema(error)) {
      throw new PublicAnalyticsRateLimitSchemaMissing();
    }

    throw error;
  }
}
