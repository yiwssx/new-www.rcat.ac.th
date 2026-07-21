import { constantTimeTextEqual, isValidCmsToken } from "../auth/cmsSessionCrypto";
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
const INTERNAL_PATHS = new Set([LOGIN_PATH, SESSION_PATH, LOGOUT_PATH, LOGOUT_ALL_PATH]);
const MAX_LOGIN_BODY_BYTES = 16 * 1024;

type VerifyCredential = (input: VerifyCmsCredentialInput) => ReturnType<typeof verifyCmsCredential>;
type CreateSession = (input: CreateCmsSessionInput) => ReturnType<typeof createCmsSession>;
type AuthenticateSession = (input: AuthenticateCmsSessionInput) => ReturnType<typeof authenticateCmsSession>;

export interface CmsAuthInternalDependencies {
  verifyCredential?: VerifyCredential;
  createSession?: CreateSession;
  authenticateSession?: AuthenticateSession;
  revokeSession?: AuthenticateSession;
  revokeAllSessions?: AuthenticateSession;
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

async function readBoundedLoginBody(request: Request) {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_LOGIN_BODY_BYTES) {
    return { status: "too-large" as const };
  }

  let bytes: ArrayBuffer;

  try {
    bytes = await request.arrayBuffer();
  } catch {
    return { status: "malformed" as const };
  }

  if (bytes.byteLength > MAX_LOGIN_BODY_BYTES) {
    return { status: "too-large" as const };
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? { status: "valid" as const, value } : { status: "malformed" as const };
  } catch {
    return { status: "malformed" as const };
  }
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

  if (pathname === LOGIN_PATH) {
    if (request.method !== "POST") {
      return internalMethodNotAllowed("POST");
    }

    const body = await readBoundedLoginBody(request);

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
