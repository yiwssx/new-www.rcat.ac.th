import type { CmsAuthenticatedIdentity } from "./cmsCredentialService";
import {
  fixedSizeBase64UrlEqual,
  generateCmsCsrfToken,
  generateCmsSessionToken,
  hashCmsClientIp,
  hashCmsCsrfToken,
  hashCmsSessionToken,
  hashCmsUserAgent,
  isValidCmsToken
} from "./cmsSessionCrypto";
import {
  createAdminSessionRepository,
  type AdminSessionRepository,
  type AdminSessionWithUser
} from "../db/adminSessionRepository";
import type { AdminRole } from "./adminAccess";
import type { AdminSessionRow, AdminAuthUserRow } from "../db/schema";
import type { Env } from "../env";

export const CMS_SESSION_IDLE_SECONDS = 30 * 60;
export const CMS_SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;
export const CMS_SESSION_TOUCH_INTERVAL_SECONDS = 5 * 60;

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const ADMIN_ROLES = new Set<AdminRole>(["admin", "editor", "viewer"]);

export interface CmsSessionIdentity {
  id: string;
  email: string;
  name: string;
  username: string | null;
  role: AdminRole;
  isRoot: boolean;
  sessionId: string;
  sessionVersion: number;
}

export interface CreatedCmsSession {
  identity: CmsSessionIdentity;
  sessionToken: string;
  csrfToken: string;
}

export type CmsSessionAuthenticationResult =
  | { status: "authenticated"; identity: CmsSessionIdentity }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export class CmsSessionEligibilityError extends Error {
  constructor() {
    super("CMS session is unavailable");
    this.name = "CmsSessionEligibilityError";
    Object.setPrototypeOf(this, CmsSessionEligibilityError.prototype);
  }
}

export interface CreateCmsSessionInput {
  env: Env;
  identity: CmsAuthenticatedIdentity;
  clientIp: string;
  userAgent: string;
  now?: Date;
  repository?: AdminSessionRepository;
  generateSessionToken?: () => string;
  generateCsrfToken?: () => string;
}

export interface AuthenticateCmsSessionInput {
  env: Env;
  sessionToken: string;
  csrfToken?: string;
  method?: string;
  now?: Date;
  repository?: AdminSessionRepository;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function safeIdentity(user: AdminAuthUserRow, session: AdminSessionRow): CmsSessionIdentity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    isRoot: user.is_root === 1,
    sessionId: session.id,
    sessionVersion: user.session_version
  };
}

function isEligibleCredentialIdentity(identity: CmsAuthenticatedIdentity) {
  return (
    ADMIN_ROLES.has(identity.role) &&
    !identity.mustChangePassword &&
    !identity.mfaRequired &&
    isPositiveInteger(identity.sessionVersion)
  );
}

function isValidStoredSession(record: AdminSessionWithUser, nowMs: number) {
  const { session, user } = record;

  if (
    session.revoked_at !== "" ||
    user.status !== "active" ||
    !ADMIN_ROLES.has(user.role) ||
    user.must_change_password !== 0 ||
    user.mfa_required !== 0 ||
    !isPositiveInteger(session.session_version) ||
    !isPositiveInteger(user.session_version) ||
    session.session_version !== user.session_version ||
    !isCanonicalTimestamp(session.created_at) ||
    !isCanonicalTimestamp(session.last_seen_at) ||
    !isCanonicalTimestamp(session.idle_expires_at) ||
    !isCanonicalTimestamp(session.absolute_expires_at)
  ) {
    return false;
  }

  return nowMs < Date.parse(session.idle_expires_at) && nowMs < Date.parse(session.absolute_expires_at);
}

function requiresCsrf(method: string | undefined) {
  return MUTATION_METHODS.has(String(method ?? "GET").toUpperCase());
}

export async function createCmsSession(input: CreateCmsSessionInput): Promise<CreatedCmsSession> {
  if (!isEligibleCredentialIdentity(input.identity)) {
    throw new CmsSessionEligibilityError();
  }

  const repository = input.repository ?? createAdminSessionRepository(input.env);
  const sessionToken = (input.generateSessionToken ?? generateCmsSessionToken)();
  const csrfToken = (input.generateCsrfToken ?? generateCmsCsrfToken)();

  if (!isValidCmsToken(sessionToken) || !isValidCmsToken(csrfToken)) {
    throw new TypeError("CMS token generation failed");
  }

  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  if (!Number.isFinite(nowMs)) {
    throw new TypeError("CMS session time is invalid");
  }

  const createdAt = now.toISOString();
  const absoluteExpiresAt = new Date(nowMs + CMS_SESSION_ABSOLUTE_SECONDS * 1000).toISOString();
  const idleExpiresAt = new Date(
    Math.min(nowMs + CMS_SESSION_IDLE_SECONDS * 1000, Date.parse(absoluteExpiresAt))
  ).toISOString();
  const secret = input.env.CMS_AUTH_PROXY_SECRET ?? "";
  const [tokenHash, csrfTokenHash, ipHash, userAgentHash] = await Promise.all([
    hashCmsSessionToken(sessionToken),
    hashCmsCsrfToken(csrfToken),
    hashCmsClientIp(input.clientIp, secret),
    hashCmsUserAgent(input.userAgent, secret)
  ]);
  const session: AdminSessionRow = {
    id: `admin-session-${crypto.randomUUID()}`,
    user_id: input.identity.id,
    token_hash: tokenHash,
    csrf_token_hash: csrfTokenHash,
    created_at: createdAt,
    last_seen_at: createdAt,
    idle_expires_at: idleExpiresAt,
    absolute_expires_at: absoluteExpiresAt,
    session_version: input.identity.sessionVersion,
    revoked_at: "",
    ip_hash: ipHash,
    user_agent_hash: userAgentHash
  };

  await repository.createSession({
    session,
    actor: input.identity.email,
    isRoot: input.identity.isRoot
  });

  return {
    identity: {
      id: input.identity.id,
      email: input.identity.email,
      name: input.identity.name,
      username: input.identity.username,
      role: input.identity.role,
      isRoot: input.identity.isRoot,
      sessionId: session.id,
      sessionVersion: input.identity.sessionVersion
    },
    sessionToken,
    csrfToken
  };
}

export async function authenticateCmsSession(
  input: AuthenticateCmsSessionInput
): Promise<CmsSessionAuthenticationResult> {
  if (!isValidCmsToken(input.sessionToken)) {
    return { status: "unauthenticated" };
  }

  const repository = input.repository ?? createAdminSessionRepository(input.env);
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  if (!Number.isFinite(nowMs)) {
    return { status: "unauthenticated" };
  }

  try {
    const tokenHash = await hashCmsSessionToken(input.sessionToken);
    const record = await repository.findSessionByTokenHash(tokenHash);

    if (!record || !isValidStoredSession(record, nowMs)) {
      return { status: "unauthenticated" };
    }

    if (requiresCsrf(input.method)) {
      if (!isValidCmsToken(input.csrfToken)) {
        return { status: "forbidden" };
      }

      const csrfHash = await hashCmsCsrfToken(input.csrfToken);

      if (!fixedSizeBase64UrlEqual(csrfHash, record.session.csrf_token_hash)) {
        return { status: "forbidden" };
      }
    }

    const touchThreshold = new Date(nowMs - CMS_SESSION_TOUCH_INTERVAL_SECONDS * 1000).toISOString();

    if (Date.parse(record.session.last_seen_at) <= Date.parse(touchThreshold)) {
      const idleExpiresAt = new Date(
        Math.min(nowMs + CMS_SESSION_IDLE_SECONDS * 1000, Date.parse(record.session.absolute_expires_at))
      ).toISOString();

      await repository.touchSession({
        sessionId: record.session.id,
        previousLastSeenAtOrBefore: touchThreshold,
        lastSeenAt: now.toISOString(),
        idleExpiresAt
      });
    }

    return { status: "authenticated", identity: safeIdentity(record.user, record.session) };
  } catch {
    return { status: "unavailable" };
  }
}

export async function revokeCmsSession(input: AuthenticateCmsSessionInput): Promise<CmsSessionAuthenticationResult> {
  const repository = input.repository ?? createAdminSessionRepository(input.env);
  const result = await authenticateCmsSession({ ...input, repository, method: "POST" });

  if (result.status !== "authenticated") {
    return result;
  }

  try {
    await repository.revokeSession({
      sessionId: result.identity.sessionId,
      userId: result.identity.id,
      actor: result.identity.email,
      now: (input.now ?? new Date()).toISOString()
    });
    return result;
  } catch {
    return { status: "unavailable" };
  }
}

export async function revokeAllCmsSessions(
  input: AuthenticateCmsSessionInput
): Promise<CmsSessionAuthenticationResult> {
  const repository = input.repository ?? createAdminSessionRepository(input.env);
  const result = await authenticateCmsSession({ ...input, repository, method: "POST" });

  if (result.status !== "authenticated") {
    return result;
  }

  try {
    await repository.revokeAllUserSessions({
      userId: result.identity.id,
      actor: result.identity.email,
      now: (input.now ?? new Date()).toISOString()
    });
    return result;
  } catch {
    return { status: "unavailable" };
  }
}
