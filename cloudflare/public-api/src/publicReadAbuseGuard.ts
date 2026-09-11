import type { Env } from "./env";

const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

export class PublicReadRateLimitExceeded extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("public read rate limit exceeded");
    this.name = "PublicReadRateLimitExceeded";
  }
}

export class PublicReadRateLimitUnavailable extends Error {
  constructor() {
    super("public read rate limiter is unavailable");
    this.name = "PublicReadRateLimitUnavailable";
  }
}

function getClientIp(request: Request) {
  return (request.headers.get("CF-Connecting-IP") || "").trim().slice(0, 80);
}

async function hashRateLimitKey(scope: string, ip: string) {
  const bytes = new TextEncoder().encode(`${scope}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `v1_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40)}`;
}

export async function enforcePublicSearchRateLimit(request: Request, env: Env) {
  const limiter = env.PUBLIC_SEARCH_RATE_LIMITER;

  if (!limiter) {
    if (env.ENVIRONMENT === "production") {
      throw new PublicReadRateLimitUnavailable();
    }
    return;
  }

  const ip = getClientIp(request);
  if (!ip) {
    return;
  }

  const key = await hashRateLimitKey("search", ip);

  try {
    const result = await limiter.limit({ key });
    if (!result.success) {
      throw new PublicReadRateLimitExceeded(RATE_LIMIT_RETRY_AFTER_SECONDS);
    }
  } catch (error) {
    if (error instanceof PublicReadRateLimitExceeded) {
      throw error;
    }

    throw new PublicReadRateLimitUnavailable();
  }
}
