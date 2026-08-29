import type { Env } from "./env";

const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;
const TRUSTED_CLIENT_IP_HEADER = "X-RCAT-CMS-Client-IP";

type SecurityRateLimitScope = "admin-api" | "cms-auth";

export class SecurityRateLimitExceeded extends Error {
  constructor(readonly retryAfterSeconds = RATE_LIMIT_RETRY_AFTER_SECONDS) {
    super("security rate limit exceeded");
    this.name = "SecurityRateLimitExceeded";
  }
}

export class SecurityRateLimitUnavailable extends Error {
  constructor() {
    super("security rate limiter is unavailable");
    this.name = "SecurityRateLimitUnavailable";
  }
}

function getRateLimiter(env: Env, scope: SecurityRateLimitScope) {
  return scope === "cms-auth" ? env.CMS_AUTH_RATE_LIMITER : env.ADMIN_API_RATE_LIMITER;
}

function readTrustedClientIp(request: Request) {
  const value = (request.headers.get(TRUSTED_CLIENT_IP_HEADER) || "").trim();
  if (!value || value.length > 64) return "";
  const hasControlCharacter = [...value].some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return point <= 31 || point === 127;
  });
  return hasControlCharacter ? "" : value;
}

async function hashRateLimitKey(scope: SecurityRateLimitScope, clientIp: string) {
  const bytes = new TextEncoder().encode(`${scope}:${clientIp}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `v1_${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40)}`;
}

export async function enforceSecurityRateLimit(request: Request, env: Env, scope: SecurityRateLimitScope) {
  const limiter = getRateLimiter(env, scope);

  if (!limiter) {
    if (env.ENVIRONMENT === "production") throw new SecurityRateLimitUnavailable();
    return;
  }

  const clientIp = readTrustedClientIp(request);
  if (!clientIp) {
    if (env.ENVIRONMENT === "production") throw new SecurityRateLimitUnavailable();
    return;
  }

  try {
    const result = await limiter.limit({ key: await hashRateLimitKey(scope, clientIp) });
    if (!result.success) throw new SecurityRateLimitExceeded();
  } catch (error) {
    if (error instanceof SecurityRateLimitExceeded) throw error;
    throw new SecurityRateLimitUnavailable();
  }
}
