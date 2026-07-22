import { constantTimeTextEqual, isValidCmsToken } from "../auth/cmsSessionCrypto";
import { hashInvitationToken, hashPasswordResetToken, isValidLifecycleToken } from "../auth/cmsLifecycleToken";
import { CMS_PASSWORD_ALGORITHM, hashCmsPassword, validateCmsPassword, verifyCmsPassword } from "../auth/cmsPassword";
import {
  CmsSessionEligibilityError,
  authenticateCmsSession,
  createCmsSession,
  revokeAllCmsSessions,
  revokeCmsSession,
  type AuthenticateCmsSessionInput,
  type CreateCmsSessionInput
} from "../auth/cmsSessionService";
import { verifyCmsCredential, type VerifyCmsCredentialInput } from "../auth/cmsCredentialService";
import {
  AdminUserLifecycleConflict,
  createAdminUserLifecycleRepository,
  type AdminUserLifecycleRepository
} from "../db/adminUserLifecycleRepository";
import type { Env } from "../env";
import { json, jsonError, methodNotAllowed } from "../responses";

export const CMS_AUTH_PROXY_SECRET_HEADER = "X-RCAT-CMS-Auth-Proxy-Secret";
export const CMS_SESSION_TOKEN_HEADER = "X-RCAT-CMS-Session-Token";
export const CMS_CSRF_TOKEN_HEADER = "X-RCAT-CMS-CSRF-Token";
export const CMS_CLIENT_IP_HEADER = "X-RCAT-CMS-Client-IP";
export const CMS_USER_AGENT_HEADER = "X-RCAT-CMS-User-Agent";
export const CMS_NEW_SESSION_TOKEN_HEADER = "X-RCAT-CMS-New-Session-Token";
export const CMS_NEW_CSRF_TOKEN_HEADER = "X-RCAT-CMS-New-CSRF-Token";

const INTERNAL_PREFIX = "/api/internal/cms-auth/";
const LOGIN_PATH = `${INTERNAL_PREFIX}login`;
const SESSION_PATH = `${INTERNAL_PREFIX}session`;
const LOGOUT_PATH = `${INTERNAL_PREFIX}logout`;
const LOGOUT_ALL_PATH = `${INTERNAL_PREFIX}logout-all`;
const INVITATION_INSPECT_PATH = `${INTERNAL_PREFIX}invitation/inspect`;
const INVITATION_ACCEPT_PATH = `${INTERNAL_PREFIX}invitation/accept`;
const PASSWORD_RESET_INSPECT_PATH = `${INTERNAL_PREFIX}password-reset/inspect`;
const PASSWORD_RESET_COMPLETE_PATH = `${INTERNAL_PREFIX}password-reset/complete`;
const CHANGE_PASSWORD_PATH = `${INTERNAL_PREFIX}change-password`;
const INTERNAL_PATHS = new Set([
  LOGIN_PATH,
  SESSION_PATH,
  LOGOUT_PATH,
  LOGOUT_ALL_PATH,
  INVITATION_INSPECT_PATH,
  INVITATION_ACCEPT_PATH,
  PASSWORD_RESET_INSPECT_PATH,
  PASSWORD_RESET_COMPLETE_PATH,
  CHANGE_PASSWORD_PATH
]);
const MAX_AUTH_BODY_BYTES = 16 * 1024;

type VerifyCredential = (input: VerifyCmsCredentialInput) => ReturnType<typeof verifyCmsCredential>;
type CreateSession = (input: CreateCmsSessionInput) => ReturnType<typeof createCmsSession>;
type AuthenticateSession = (input: AuthenticateCmsSessionInput) => ReturnType<typeof authenticateCmsSession>;

export interface CmsAuthInternalDependencies {
  verifyCredential?: VerifyCredential;
  createSession?: CreateSession;
  authenticateSession?: AuthenticateSession;
  revokeSession?: AuthenticateSession;
  revokeAllSessions?: AuthenticateSession;
  lifecycleRepository?: AdminUserLifecycleRepository;
  hashPassword?: (password: string) => Promise<string>;
  verifyPassword?: (password: string, storedHash: string, algorithm: string) => Promise<boolean>;
  now?: () => Date;
}

function noStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function internalError(message: string, status: number) {
  return noStore(jsonError(message, status, { resource: "cms-auth" }));
}

function internalMethodNotAllowed(allow: string) {
  const response = methodNotAllowed();
  response.headers.set("Allow", allow);
  return noStore(response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readBoundedAuthBody(request: Request) {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
    return { status: "too-large" as const };
  }

  let bytes: ArrayBuffer;

  try {
    bytes = await request.arrayBuffer();
  } catch {
    return { status: "malformed" as const };
  }

  if (bytes.byteLength > MAX_AUTH_BODY_BYTES) {
    return { status: "too-large" as const };
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? { status: "valid" as const, value } : { status: "malformed" as const };
  } catch {
    return { status: "malformed" as const };
  }
}

function normalizeLifecycleUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._-]{3,64}$/.test(normalized) ? normalized : null;
}

function invitationInvalid() {
  return internalError("invitation is invalid or expired", 400);
}

function passwordResetInvalid() {
  return internalError("password-reset link is invalid or expired", 400);
}

function validateNewPasswordBody(body: Record<string, unknown>): { error: Response } | { password: string } {
  if (typeof body.password !== "string" || typeof body.passwordConfirmation !== "string") {
    return { error: internalError("password and password confirmation are required", 400) };
  }

  if (body.password !== body.passwordConfirmation) {
    return { error: internalError("password confirmation does not match", 400) };
  }

  const policy = validateCmsPassword(body.password);

  if (!policy.valid) {
    return {
      error: noStore(jsonError("password policy validation failed", 400, { resource: "cms-auth", code: policy.code }))
    };
  }

  return { password: body.password };
}

function maskEmail(email: string) {
  const separator = email.lastIndexOf("@");

  if (separator <= 0) {
    return "***";
  }

  return `${email[0]}***${email.slice(separator)}`;
}

async function handleInvitationLifecycle(
  request: Request,
  env: Env,
  pathname: string,
  now: Date,
  dependencies: CmsAuthInternalDependencies
): Promise<Response> {
  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const body = await readBoundedAuthBody(request);

  if (body.status === "too-large") {
    return internalError("request body is too large", 413);
  }

  if (body.status !== "valid" || !isValidLifecycleToken(body.value.token)) {
    return invitationInvalid();
  }

  const repository = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const tokenHash = await hashInvitationToken(body.value.token);
  const inspection = await repository.inspectInvitationByTokenHash(tokenHash, now.toISOString());

  if (!inspection) {
    return invitationInvalid();
  }

  if (pathname === INVITATION_INSPECT_PATH) {
    return noStore(
      json({
        valid: true,
        user: {
          email: inspection.email,
          name: inspection.name,
          role: inspection.role,
          username: inspection.username
        },
        expiresAt: inspection.expiresAt
      })
    );
  }

  const passwordResult = validateNewPasswordBody(body.value);

  if ("error" in passwordResult) {
    return passwordResult.error;
  }

  const usernameProvided = Object.prototype.hasOwnProperty.call(body.value, "username");
  const username = usernameProvided ? normalizeLifecycleUsername(body.value.username) : null;

  if (usernameProvided && !username) {
    return internalError("username is invalid", 400);
  }

  if (inspection.username && username && inspection.username.toLowerCase() !== username) {
    return internalError("preassigned username cannot be replaced", 409);
  }

  const effectiveUsername = inspection.username ?? username;

  if (effectiveUsername && !(await repository.isUsernameAvailable(effectiveUsername, inspection.userId))) {
    return internalError("username is already in use", 409);
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const passwordHash = await hashPassword(passwordResult.password);

  try {
    await repository.acceptInvitation({
      invitationId: inspection.invitationId,
      userId: inspection.userId,
      tokenHash,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      username: effectiveUsername,
      expectedUsername: inspection.username,
      actor: "cms-invitation",
      now: now.toISOString()
    });
  } catch (error) {
    if (error instanceof AdminUserLifecycleConflict) {
      return error.code === "duplicate_username"
        ? internalError("username is already in use", 409)
        : invitationInvalid();
    }

    throw error;
  }

  return noStore(json({ ok: true, credentialConfigured: true }));
}

async function handlePasswordResetLifecycle(
  request: Request,
  env: Env,
  pathname: string,
  now: Date,
  dependencies: CmsAuthInternalDependencies
): Promise<Response> {
  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const body = await readBoundedAuthBody(request);

  if (body.status === "too-large") {
    return internalError("request body is too large", 413);
  }

  if (body.status !== "valid" || !isValidLifecycleToken(body.value.token)) {
    return passwordResetInvalid();
  }

  const repository = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const tokenHash = await hashPasswordResetToken(body.value.token);
  const inspection = await repository.inspectPasswordResetByTokenHash(tokenHash, now.toISOString());

  if (!inspection) {
    return passwordResetInvalid();
  }

  if (pathname === PASSWORD_RESET_INSPECT_PATH) {
    return noStore(
      json({ valid: true, user: { emailHint: maskEmail(inspection.email) }, expiresAt: inspection.expiresAt })
    );
  }

  const passwordResult = validateNewPasswordBody(body.value);

  if ("error" in passwordResult) {
    return passwordResult.error;
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const passwordHash = await hashPassword(passwordResult.password);

  try {
    await repository.completePasswordReset({
      resetTokenId: inspection.resetTokenId,
      userId: inspection.userId,
      tokenHash,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      actor: "cms-password-reset",
      now: now.toISOString()
    });
  } catch (error) {
    if (error instanceof AdminUserLifecycleConflict) {
      return passwordResetInvalid();
    }

    throw error;
  }

  return noStore(json({ ok: true, passwordReset: true }));
}

async function handlePasswordChange(
  request: Request,
  env: Env,
  now: Date,
  dependencies: CmsAuthInternalDependencies
): Promise<Response> {
  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const body = await readBoundedAuthBody(request);

  if (body.status === "too-large") {
    return internalError("request body is too large", 413);
  }

  if (body.status !== "valid" || typeof body.value.currentPassword !== "string" || !body.value.currentPassword) {
    return internalError("current password is required", 400);
  }

  const authenticateSession = dependencies.authenticateSession ?? authenticateCmsSession;
  const session = await authenticateSession(getSessionInput(request, env, now));

  if (session.status !== "authenticated") {
    return sessionFailure(session.status);
  }

  const passwordResult = validateNewPasswordBody(body.value);

  if ("error" in passwordResult) {
    return passwordResult.error;
  }

  const repository = dependencies.lifecycleRepository ?? createAdminUserLifecycleRepository(env);
  const credential = await repository.getCredentialByUserId(session.identity.id);
  const verifyPassword = dependencies.verifyPassword ?? verifyCmsPassword;

  if (
    !credential ||
    !(await verifyPassword(body.value.currentPassword, credential.password_hash, credential.password_algorithm))
  ) {
    return internalError("current password is invalid", 401);
  }

  if (await verifyPassword(passwordResult.password, credential.password_hash, credential.password_algorithm)) {
    return internalError("new password must differ from current password", 400);
  }

  const hashPassword = dependencies.hashPassword ?? hashCmsPassword;
  const passwordHash = await hashPassword(passwordResult.password);

  try {
    await repository.changeUserPassword({
      userId: session.identity.id,
      expectedPasswordHash: credential.password_hash,
      passwordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      actor: session.identity.email,
      now: now.toISOString()
    });
  } catch (error) {
    if (error instanceof AdminUserLifecycleConflict) {
      return internalError("current password is invalid", 401);
    }

    throw error;
  }

  return noStore(json({ ok: true, passwordChanged: true }));
}

function readMetadataHeader(request: Request, name: string, maximumLength: number) {
  const value = request.headers.get(name) ?? "";
  const hasControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });

  if (!value || value.length > maximumLength || hasControlCharacter) {
    return "unknown";
  }

  return value;
}

function getSessionInput(request: Request, env: Env, now: Date): AuthenticateCmsSessionInput {
  return {
    env,
    sessionToken: request.headers.get(CMS_SESSION_TOKEN_HEADER) ?? "",
    csrfToken: request.headers.get(CMS_CSRF_TOKEN_HEADER) ?? undefined,
    method: request.method,
    now
  };
}

function sessionFailure(status: "forbidden" | "unauthenticated" | "unavailable") {
  if (status === "forbidden") {
    return internalError("CSRF validation failed", 403);
  }

  if (status === "unavailable") {
    return internalError("CMS authentication is unavailable", 503);
  }

  return internalError("CMS session is invalid or expired", 401);
}

async function authorizeInternalRequest(request: Request, env: Env) {
  if (env.CMS_AUTH_ENABLED !== "true") {
    return internalError("not found", 404);
  }

  const configuredSecret = env.CMS_AUTH_PROXY_SECRET ?? "";

  if (configuredSecret.length < 32) {
    return internalError("CMS authentication is unavailable", 503);
  }

  if (request.headers.has("Origin")) {
    return internalError("browser-origin request is not allowed", 403);
  }

  const providedSecret = request.headers.get(CMS_AUTH_PROXY_SECRET_HEADER) ?? "";

  if (!(await constantTimeTextEqual(providedSecret, configuredSecret))) {
    return internalError("internal authentication failed", 403);
  }

  return null;
}

export async function handleCmsAuthInternal(
  request: Request,
  env: Env,
  dependencies: CmsAuthInternalDependencies = {}
): Promise<Response | null> {
  const { pathname } = new URL(request.url);

  if (!pathname.startsWith(INTERNAL_PREFIX)) {
    return null;
  }

  if (!INTERNAL_PATHS.has(pathname)) {
    return internalError("not found", 404);
  }

  const authorizationError = await authorizeInternalRequest(request, env);

  if (authorizationError) {
    return authorizationError;
  }

  const now = dependencies.now?.() ?? new Date();

  if (pathname === INVITATION_INSPECT_PATH || pathname === INVITATION_ACCEPT_PATH) {
    try {
      return await handleInvitationLifecycle(request, env, pathname, now, dependencies);
    } catch {
      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === PASSWORD_RESET_INSPECT_PATH || pathname === PASSWORD_RESET_COMPLETE_PATH) {
    try {
      return await handlePasswordResetLifecycle(request, env, pathname, now, dependencies);
    } catch {
      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === CHANGE_PASSWORD_PATH) {
    try {
      return await handlePasswordChange(request, env, now, dependencies);
    } catch {
      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === LOGIN_PATH) {
    if (request.method !== "POST") {
      return internalMethodNotAllowed("POST");
    }

    const body = await readBoundedAuthBody(request);

    if (body.status === "too-large") {
      return internalError("request body is too large", 413);
    }

    if (
      body.status !== "valid" ||
      typeof body.value.identifier !== "string" ||
      typeof body.value.password !== "string"
    ) {
      return internalError("invalid login request", 400);
    }

    const verifyCredential = dependencies.verifyCredential ?? verifyCmsCredential;
    const credential = await verifyCredential({
      env,
      identifier: body.value.identifier,
      password: body.value.password,
      now
    });

    if (credential.status === "unavailable") {
      return internalError("CMS authentication is unavailable", 503);
    }

    if (credential.status !== "success") {
      return internalError("invalid identifier or password", 401);
    }

    try {
      const createSession = dependencies.createSession ?? createCmsSession;
      const created = await createSession({
        env,
        identity: credential.identity,
        clientIp: readMetadataHeader(request, CMS_CLIENT_IP_HEADER, 64),
        userAgent: readMetadataHeader(request, CMS_USER_AGENT_HEADER, 512),
        now
      });
      const response = noStore(json({ ok: true, user: created.identity }));
      response.headers.set(CMS_NEW_SESSION_TOKEN_HEADER, created.sessionToken);
      response.headers.set(CMS_NEW_CSRF_TOKEN_HEADER, created.csrfToken);
      return response;
    } catch (error) {
      if (error instanceof CmsSessionEligibilityError) {
        return internalError("CMS session is unavailable", 403);
      }

      return internalError("CMS authentication is unavailable", 503);
    }
  }

  if (pathname === SESSION_PATH) {
    if (request.method !== "GET") {
      return internalMethodNotAllowed("GET");
    }

    const authenticateSession = dependencies.authenticateSession ?? authenticateCmsSession;
    const result = await authenticateSession(getSessionInput(request, env, now));

    return result.status === "authenticated"
      ? noStore(json({ ok: true, user: result.identity }))
      : sessionFailure(result.status);
  }

  if (request.method !== "POST") {
    return internalMethodNotAllowed("POST");
  }

  const rawSessionToken = request.headers.get(CMS_SESSION_TOKEN_HEADER) ?? "";
  const rawCsrfToken = request.headers.get(CMS_CSRF_TOKEN_HEADER) ?? "";

  if (!isValidCmsToken(rawSessionToken)) {
    return internalError("CMS session is invalid or expired", 401);
  }

  if (!isValidCmsToken(rawCsrfToken)) {
    return internalError("CSRF validation failed", 403);
  }

  const operation =
    pathname === LOGOUT_PATH
      ? (dependencies.revokeSession ?? revokeCmsSession)
      : (dependencies.revokeAllSessions ?? revokeAllCmsSessions);
  const result = await operation(getSessionInput(request, env, now));

  return result.status === "authenticated" ? noStore(json({ ok: true })) : sessionFailure(result.status);
}
