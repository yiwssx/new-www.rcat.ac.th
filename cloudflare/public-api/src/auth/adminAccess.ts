import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "../env";
import { jsonError } from "../responses";

const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
const SMOKE_TOKEN_HEADER = "X-RCAT-Admin-Smoke-Token";
const PRODUCTION_CONTEXT_PATTERN = /(^|[-_.])(prod|production|live)([-_.]|$)/i;

export interface AdminIdentity {
  actor: string;
  mode: "cloudflare-access" | "smoke-token";
}

export interface AdminAuthResult {
  identity: AdminIdentity | null;
  response: Response | null;
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getEnvironmentValue(env: Env, key: string) {
  const value = (env as unknown as Record<string, unknown>)[key];

  return typeof value === "string" ? value : "";
}

export function hasProductionContext(env: Env) {
  return ["ENVIRONMENT", "ENV", "CF_PAGES_BRANCH"].some((key) =>
    PRODUCTION_CONTEXT_PATTERN.test(getEnvironmentValue(env, key))
  );
}

function getAllowedEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getIssuer(teamDomain: string) {
  return `https://${teamDomain}.cloudflareaccess.com`;
}

function makeAccessJwks(env: Env) {
  const localJwksJson = trimString(env.ADMIN_WRITE_ACCESS_JWKS_JSON);

  if (localJwksJson) {
    const parsed = JSON.parse(localJwksJson);
    return createLocalJWKSet(parsed);
  }

  const teamDomain = trimString(env.ADMIN_WRITE_ACCESS_TEAM_DOMAIN);
  return createRemoteJWKSet(new URL(`${getIssuer(teamDomain)}/cdn-cgi/access/certs`));
}

function getEmailClaim(payload: JWTPayload) {
  const email = payload.email;

  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

async function verifyCloudflareAccess(request: Request, env: Env): Promise<AdminAuthResult> {
  const teamDomain = trimString(env.ADMIN_WRITE_ACCESS_TEAM_DOMAIN);
  const audience = trimString(env.ADMIN_WRITE_ACCESS_AUD);

  if (!teamDomain || !audience) {
    return {
      identity: null,
      response: jsonError("admin access is not configured", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  const token = trimString(request.headers.get(ACCESS_JWT_HEADER));

  if (!token) {
    return {
      identity: null,
      response: jsonError("admin access assertion is required", 401, {
        resource: "admin-structured-data"
      })
    };
  }

  try {
    const { payload } = await jwtVerify(token, makeAccessJwks(env), {
      issuer: getIssuer(teamDomain),
      audience
    });
    const email = getEmailClaim(payload);
    const allowedEmails = getAllowedEmails(env.ADMIN_WRITE_ALLOWED_EMAILS);

    if (!email || (allowedEmails.length > 0 && !allowedEmails.includes(email))) {
      return {
        identity: null,
        response: jsonError("admin access identity is not allowed", 403, {
          resource: "admin-structured-data"
        })
      };
    }

    return {
      identity: {
        actor: email,
        mode: "cloudflare-access"
      },
      response: null
    };
  } catch {
    return {
      identity: null,
      response: jsonError("admin access assertion is invalid", 403, {
        resource: "admin-structured-data"
      })
    };
  }
}

function verifySmokeToken(request: Request, env: Env): AdminAuthResult {
  if (request.headers.get("Origin")) {
    return {
      identity: null,
      response: jsonError("smoke authentication is not allowed for browser-origin requests", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  if (env.ADMIN_WRITE_SMOKE_ENABLED !== "true") {
    return {
      identity: null,
      response: jsonError("admin smoke authentication is disabled", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  const configuredToken = trimString(env.ADMIN_WRITE_SMOKE_TOKEN);

  if (!configuredToken) {
    return {
      identity: null,
      response: jsonError("admin smoke credential is not configured", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  const requestToken = trimString(request.headers.get(SMOKE_TOKEN_HEADER));

  if (!requestToken) {
    return {
      identity: null,
      response: jsonError("admin smoke credential is required", 401, {
        resource: "admin-structured-data"
      })
    };
  }

  if (requestToken !== configuredToken) {
    return {
      identity: null,
      response: jsonError("admin smoke credential is invalid", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  return {
    identity: {
      actor: "m18-preview-smoke",
      mode: "smoke-token"
    },
    response: null
  };
}

export async function authenticateAdminRequest(request: Request, env: Env): Promise<AdminAuthResult> {
  if (env.ADMIN_WRITE_PREVIEW_ENABLED !== "true") {
    return {
      identity: null,
      response: jsonError("admin write preview gate is disabled", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  if (hasProductionContext(env)) {
    return {
      identity: null,
      response: jsonError("admin write preview gate is not available for production-like context", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  if (request.headers.get("Origin")) {
    return verifyCloudflareAccess(request, env);
  }

  if (trimString(request.headers.get(SMOKE_TOKEN_HEADER))) {
    return verifySmokeToken(request, env);
  }

  if (env.ADMIN_WRITE_AUTH_MODE === "cloudflare-access") {
    return verifyCloudflareAccess(request, env);
  }

  return verifySmokeToken(request, env);
}

export function getAdminAuthCorsHeaders() {
  return {
    accessJwtHeader: ACCESS_JWT_HEADER,
    smokeTokenHeader: SMOKE_TOKEN_HEADER
  };
}
