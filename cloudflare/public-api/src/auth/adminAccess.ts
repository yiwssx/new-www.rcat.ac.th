import type { Env } from "../env";
import { jsonError } from "../responses";
import { constantTimeTextEqual } from "./cmsSessionCrypto";
import { authenticateCmsSession, type AuthenticateCmsSessionInput } from "./cmsSessionService";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../routes/cmsAuthInternal";

const PRODUCTION_CONTEXT_PATTERN = /(^|[-_.])(prod|production|live)([-_.]|$)/i;

export interface AdminIdentity {
  actor: string;
  email: string;
  mode: "cms-session";
  role: AdminRole;
  userId: string;
  sessionId: string;
  isRoot: boolean;
  reauthenticatedAt: string;
  mfaVerifiedAt: string;
}

export type AdminRole = "admin" | "editor" | "viewer";

export interface AdminAuthResult {
  identity: AdminIdentity | null;
  response: Response | null;
}

export interface AdminAccessDependencies {
  authenticateCmsSession?: (input: AuthenticateCmsSessionInput) => ReturnType<typeof authenticateCmsSession>;
  touchSession?: boolean;
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

function readRequiredMetadata(request: Request, name: string, maximumLength: number) {
  const value = request.headers.get(name) ?? "";
  const containsControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });

  return value.length > 0 && value.length <= maximumLength && !containsControlCharacter ? value : null;
}

async function verifyCmsSession(
  request: Request,
  env: Env,
  dependencies: AdminAccessDependencies
): Promise<AdminAuthResult> {
  const configuredSecret = env.CMS_AUTH_PROXY_SECRET ?? "";

  if (configuredSecret.length < 32) {
    return {
      identity: null,
      response: jsonError("CMS authentication is unavailable", 503, {
        resource: "admin-structured-data"
      })
    };
  }

  if (request.headers.has("Origin")) {
    return {
      identity: null,
      response: jsonError("CMS proxy authentication is not allowed for browser-origin requests", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  const providedSecret = request.headers.get(CMS_AUTH_PROXY_SECRET_HEADER) ?? "";

  if (!(await constantTimeTextEqual(providedSecret, configuredSecret))) {
    return {
      identity: null,
      response: jsonError("CMS proxy authentication failed", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  const clientIp = readRequiredMetadata(request, CMS_CLIENT_IP_HEADER, 64);
  const userAgent = readRequiredMetadata(request, CMS_USER_AGENT_HEADER, 512);

  if (!clientIp || !userAgent) {
    return {
      identity: null,
      response: jsonError("CMS proxy metadata is invalid", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  const authenticateSession = dependencies.authenticateCmsSession ?? authenticateCmsSession;
  const result = await authenticateSession({
    env,
    sessionToken: request.headers.get(CMS_SESSION_TOKEN_HEADER) ?? "",
    csrfToken: request.headers.get(CMS_CSRF_TOKEN_HEADER) ?? undefined,
    clientIp,
    userAgent,
    method: request.method,
    touchSession: dependencies.touchSession
  });

  if (result.status === "forbidden") {
    return {
      identity: null,
      response: jsonError("CSRF validation failed", 403, {
        resource: "admin-structured-data"
      })
    };
  }

  if (result.status === "unavailable") {
    return {
      identity: null,
      response: jsonError("CMS authentication is unavailable", 503, {
        resource: "admin-structured-data"
      })
    };
  }

  if (result.status !== "authenticated") {
    return {
      identity: null,
      response: jsonError("CMS session is invalid or expired", 401, {
        resource: "admin-structured-data"
      })
    };
  }

  return {
    identity: {
      actor: result.identity.email,
      email: result.identity.email,
      mode: "cms-session",
      role: result.identity.role,
      userId: result.identity.id,
      sessionId: result.identity.sessionId,
      isRoot: result.identity.isRoot,
      reauthenticatedAt: result.identity.reauthenticatedAt,
      mfaVerifiedAt: result.identity.mfaVerifiedAt
    },
    response: null
  };
}

export async function authenticateAdminRequest(
  request: Request,
  env: Env,
  dependencies: AdminAccessDependencies = {}
): Promise<AdminAuthResult> {
  return verifyCmsSession(request, env, dependencies);
}
