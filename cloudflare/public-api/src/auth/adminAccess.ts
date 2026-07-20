import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "../env";
import { jsonError } from "../responses";

const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
const SMOKE_TOKEN_HEADER = "X-RCAT-Admin-Smoke-Token";
const PROXY_EMAIL_HEADER = "X-RCAT-Admin-Proxy-Email";
const PROXY_ROLE_HEADER = "X-RCAT-Admin-Proxy-Role";
const PRODUCTION_CONTEXT_PATTERN = /(^|[-_.])(prod|production|live)([-_.]|$)/i;

export interface AdminIdentity {
  actor: string;
  email: string;
  mode: "cloudflare-access" | "smoke-token";
  role: AdminRole;
}

export type AdminRole = "admin" | "editor" | "viewer";

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

function getRoleEmails(env: Env) {
  return {
    admin: getAllowedEmails(env.ADMIN_RBAC_ADMINS),
    editor: getAllowedEmails(env.ADMIN_RBAC_EDITORS),
    viewer: getAllowedEmails(env.ADMIN_RBAC_VIEWERS)
  } satisfies Record<AdminRole, string[]>;
}

function getDuplicateRoleEmails(roleEmails: Record<AdminRole, string[]>) {
  const seen = new Map<string, AdminRole>();
  const duplicates = new Set<string>();

  (Object.entries(roleEmails) as Array<[AdminRole, string[]]>).forEach(([role, emails]) => {
    emails.forEach((email) => {
      const existingRole = seen.get(email);

      if (existingRole && existingRole !== role) {
        duplicates.add(email);
        return;
      }

      seen.set(email, role);
    });
  });

  return duplicates;
}

function resolveAdminRole(email: string, env: Env) {
  const roleEmails = getRoleEmails(env);
  const duplicates = getDuplicateRoleEmails(roleEmails);

  if (duplicates.size > 0) {
    return {
      role: null,
      response: jsonError("admin access role configuration is invalid", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  if (roleEmails.admin.includes(email)) {
    return { role: "admin" as const, response: null };
  }

  if (roleEmails.editor.includes(email)) {
    return { role: "editor" as const, response: null };
  }

  if (roleEmails.viewer.includes(email)) {
    return { role: "viewer" as const, response: null };
  }

  return {
    role: null,
    response: jsonError("admin access identity is not allowed", 403, {
      resource: "admin-structured-data"
    })
  };
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

function getProxyEmail(request: Request) {
  const email = trimString(request.headers.get(PROXY_EMAIL_HEADER)).toLowerCase();

  if (email.length === 0 || email.length > 254 || /\s/.test(email) || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return null;
  }

  return email;
}

function getProxyRole(request: Request): AdminRole | null {
  const role = trimString(request.headers.get(PROXY_ROLE_HEADER)).toLowerCase();

  if (role === "admin" || role === "editor" || role === "viewer") {
    return role;
  }

  return null;
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

    const roleResult = resolveAdminRole(email, env);

    if (roleResult.response || !roleResult.role) {
      return {
        identity: null,
        response: roleResult.response
      };
    }

    return {
      identity: {
        actor: email,
        email,
        mode: "cloudflare-access",
        role: roleResult.role
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

  const proxyEmail = getProxyEmail(request);
  const proxyRole = getProxyRole(request);

  if (!proxyEmail || !proxyRole) {
    return {
      identity: null,
      response: jsonError("admin smoke proxy identity is invalid", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  return {
    identity: {
      actor: proxyEmail,
      email: proxyEmail,
      mode: "smoke-token",
      role: proxyRole
    },
    response: null
  };
}

export function isAdmin(identity: AdminIdentity) {
  return identity.role === "admin";
}

export function isEditor(identity: AdminIdentity) {
  return identity.role === "editor";
}

export function canReadAdminData(identity: AdminIdentity) {
  return identity.role === "admin" || identity.role === "editor" || identity.role === "viewer";
}

export function canManageContent(identity: AdminIdentity) {
  return identity.role === "admin" || identity.role === "editor";
}

export function canPublishContent(identity: AdminIdentity) {
  return canManageContent(identity);
}

export function canManageMedia(identity: AdminIdentity) {
  return identity.role === "admin" || identity.role === "editor";
}

export function canManageWebsiteSettings(identity: AdminIdentity) {
  return identity.role === "admin";
}

export function canManageMenu(identity: AdminIdentity) {
  return identity.role === "admin";
}

export function canManageIntegrations(identity: AdminIdentity) {
  return identity.role === "admin";
}

export function canManageUsers(identity: AdminIdentity) {
  return identity.role === "admin";
}

export function canManageSystemBackup(identity: AdminIdentity) {
  return identity.role === "admin";
}

export function canSelfEditUserProfile(identity: AdminIdentity) {
  return identity.role === "admin" || identity.role === "editor";
}

export function requireAdminPermission(
  identity: AdminIdentity,
  predicate: (identity: AdminIdentity) => boolean,
  message: string,
  resource = "admin-structured-data"
) {
  return predicate(identity)
    ? null
    : jsonError(message, 403, {
        resource
      });
}

export function requireAdminRole(identity: AdminIdentity) {
  return isAdmin(identity)
    ? null
    : jsonError("admin role is required", 403, {
        resource: "admin-structured-data"
      });
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
