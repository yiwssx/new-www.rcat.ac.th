import type { Env } from "./env";

const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

type PublicAnalyticsScope = "site-view" | "presence" | "content-view" | "runtime-incident";

export class PublicAnalyticsRateLimitExceeded extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("public analytics rate limit exceeded");
    this.name = "PublicAnalyticsRateLimitExceeded";
  }
}

export class PublicAnalyticsRateLimitUnavailable extends Error {
  constructor() {
    super("public analytics rate limiter is unavailable");
    this.name = "PublicAnalyticsRateLimitUnavailable";
  }
}

function getClientIp(request: Request) {
  return (request.headers.get("CF-Connecting-IP") || "").trim().slice(0, 80);
}

function getRateLimiter(env: Env, scope: PublicAnalyticsScope) {
  if (scope === "site-view") return env.PUBLIC_SITE_VIEW_RATE_LIMITER;
  if (scope === "presence") return env.PUBLIC_PRESENCE_RATE_LIMITER;
  if (scope === "runtime-incident") return env.RUNTIME_INCIDENT_RATE_LIMITER;
  return env.PUBLIC_CONTENT_VIEW_RATE_LIMITER;
}

async function hashRateLimitKey(scope: PublicAnalyticsScope, ip: string) {
  const bytes = new TextEncoder().encode(`${scope}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `v1_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40)}`;
}

export async function enforcePublicAnalyticsRateLimit(
  request: Request,
  env: Env,
  input: { scope: PublicAnalyticsScope }
) {
  const limiter = getRateLimiter(env, input.scope);

  // Unit tests and local callers may construct Env without Cloudflare bindings.
  // Production fails closed so a misconfigured release cannot silently disable
  // abuse protection.
  if (!limiter) {
    if (env.ENVIRONMENT === "production") {
      throw new PublicAnalyticsRateLimitUnavailable();
    }
    return;
  }

  const ip = getClientIp(request);

  // Cloudflare supplies CF-Connecting-IP in production. Local tooling may not.
  if (!ip) {
    return;
  }

  const key = await hashRateLimitKey(input.scope, ip);

  try {
    const result = await limiter.limit({ key });

    if (!result.success) {
      throw new PublicAnalyticsRateLimitExceeded(RATE_LIMIT_RETRY_AFTER_SECONDS);
    }
  } catch (error) {
    if (error instanceof PublicAnalyticsRateLimitExceeded) {
      throw error;
    }

    throw new PublicAnalyticsRateLimitUnavailable();
  }
}
