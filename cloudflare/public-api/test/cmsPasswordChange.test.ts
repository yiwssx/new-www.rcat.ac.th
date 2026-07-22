// @vitest-environment node
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { AdminUserLifecycleRepository } from "../src/db/adminUserLifecycleRepository";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  handleCmsAuthInternal
} from "../src/routes/cmsAuthInternal";
import type { Env } from "../src/env";
import * as cmsAuthHandlersModule from "../../../server/cmsAuth/handlers.mjs";
import * as cmsAuthCookiesModule from "../../../server/cmsAuth/cookies.mjs";

const { CMS_BROWSER_CSRF_HEADER, handleCmsPasswordChange } = cmsAuthHandlersModule as unknown as {
  CMS_BROWSER_CSRF_HEADER: string;
  handleCmsPasswordChange: (request: unknown, response: unknown, options?: Record<string, unknown>) => Promise<void>;
};
const { getCmsCsrfCookieName, getCmsSessionCookieName } = cmsAuthCookiesModule as unknown as {
  getCmsCsrfCookieName: () => string;
  getCmsSessionCookieName: () => string;
};

const proxySecret = "phase-5-change-proxy-secret-repeated-00000000000000";
const sessionToken = "S".repeat(43);
const csrfToken = "C".repeat(43);
const now = new Date("2026-07-22T06:00:00.000Z");
const identity = {
  id: "user-1",
  email: "user@example.test",
  name: "User",
  username: "user.name",
  role: "editor" as const,
  isRoot: false,
  sessionId: "session-1",
  sessionVersion: 2
};
const credential = {
  user_id: identity.id,
  password_hash: "current-hash",
  password_algorithm: "bcrypt-sha384-v1",
  password_changed_at: "2026-07-01T00:00:00.000Z",
  failed_login_count: 4,
  locked_until: "2026-07-22T06:05:00.000Z",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z"
};

function env(): Env {
  return { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: proxySecret };
}

function workerRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://worker.example.test/api/internal/cms-auth/change-password", {
    method: "POST",
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
      [CMS_SESSION_TOKEN_HEADER]: sessionToken,
      [CMS_CSRF_TOKEN_HEADER]: csrfToken,
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function repository(overrides: Partial<AdminUserLifecycleRepository> = {}) {
  return {
    getCredentialByUserId: vi.fn().mockResolvedValue(credential),
    changeUserPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as AdminUserLifecycleRepository;
}

function successDependencies(lifecycleRepository = repository()) {
  return {
    lifecycleRepository,
    authenticateSession: vi.fn().mockResolvedValue({ status: "authenticated", identity }),
    verifyPassword: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    hashPassword: vi.fn().mockResolvedValue("replacement-hash"),
    now: () => now
  };
}

function nodeRequest({ body, headers = {}, url = "/api/cms-auth/change-password" }: Record<string, unknown>) {
  const stream = Readable.from([JSON.stringify(body)]) as Readable & {
    method: string;
    url: unknown;
    headers: Record<string, string>;
  };
  stream.method = "POST";
  stream.url = url;
  stream.headers = Object.fromEntries(
    Object.entries(headers as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value])
  );
  return stream;
}

function nodeResponse() {
  const headers = new Map<string, unknown>();
  let body = "";
  return {
    statusCode: 200,
    setHeader(name: string, value: unknown) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    end(value?: unknown) {
      body = value === undefined ? "" : String(value);
    },
    get bodyText() {
      return body;
    }
  };
}

describe("CMS self password change", () => {
  it("requires a valid CMS Session and CSRF result", async () => {
    const dependencies = successDependencies();
    dependencies.authenticateSession = vi.fn().mockResolvedValue({ status: "forbidden" });
    const response = await handleCmsAuthInternal(
      workerRequest({
        currentPassword: "the current password",
        password: "the replacement password",
        passwordConfirmation: "the replacement password"
      }),
      env(),
      dependencies
    );
    expect(response?.status).toBe(403);
  });

  it.each(["admin", "editor", "viewer"] as const)(
    "allows the current D1 %s role through auth.change-password-self",
    async (role) => {
      const lifecycleRepository = repository();
      const dependencies = successDependencies(lifecycleRepository);
      dependencies.authenticateSession = vi
        .fn()
        .mockResolvedValue({ status: "authenticated", identity: { ...identity, role } });

      const response = await handleCmsAuthInternal(
        workerRequest({
          currentPassword: "the current password",
          password: "the replacement password",
          passwordConfirmation: "the replacement password"
        }),
        env(),
        dependencies
      );

      expect(response?.status).toBe(200);
      expect(lifecycleRepository.getCredentialByUserId).toHaveBeenCalledWith(identity.id);
    }
  );

  it("fails closed when the authenticated D1 role lacks auth.change-password-self", async () => {
    const lifecycleRepository = repository();
    const dependencies = successDependencies(lifecycleRepository);
    dependencies.authenticateSession = vi.fn().mockResolvedValue({
      status: "authenticated",
      identity: { ...identity, role: "invalid-role" }
    });

    const response = await handleCmsAuthInternal(
      workerRequest({
        currentPassword: "the current password",
        password: "the replacement password",
        passwordConfirmation: "the replacement password"
      }),
      env(),
      dependencies
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({ error: "required permission is missing" });
    expect(lifecycleRepository.getCredentialByUserId).not.toHaveBeenCalled();
    expect(lifecycleRepository.changeUserPassword).not.toHaveBeenCalled();
  });

  it("ignores a body identifier and changes only the Session user", async () => {
    const lifecycleRepository = repository();
    const response = await handleCmsAuthInternal(
      workerRequest({
        identifier: "victim@example.test",
        currentPassword: "the current password",
        password: "the replacement password",
        passwordConfirmation: "the replacement password"
      }),
      env(),
      successDependencies(lifecycleRepository)
    );
    expect(response?.status).toBe(200);
    expect(lifecycleRepository.getCredentialByUserId).toHaveBeenCalledWith(identity.id);
    expect(lifecycleRepository.changeUserPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: identity.id,
        expectedPasswordHash: credential.password_hash,
        passwordHash: "replacement-hash",
        passwordAlgorithm: "bcrypt-sha384-v1",
        now: now.toISOString()
      })
    );
  });

  it("requires the current password and fails a wrong value generically", async () => {
    const missing = await handleCmsAuthInternal(
      workerRequest({ password: "the replacement password", passwordConfirmation: "the replacement password" }),
      env(),
      successDependencies()
    );
    const wrongDependencies = successDependencies();
    wrongDependencies.verifyPassword = vi.fn().mockResolvedValue(false);
    const wrong = await handleCmsAuthInternal(
      workerRequest({
        currentPassword: "wrong current password",
        password: "the replacement password",
        passwordConfirmation: "the replacement password"
      }),
      env(),
      wrongDependencies
    );
    expect(missing?.status).toBe(400);
    expect(wrong?.status).toBe(401);
    await expect(wrong?.json()).resolves.toMatchObject({ error: "current password is invalid" });
  });

  it("enforces policy, confirmation, and password non-reuse", async () => {
    const weak = await handleCmsAuthInternal(
      workerRequest({ currentPassword: "current", password: "short", passwordConfirmation: "short" }),
      env(),
      successDependencies()
    );
    const mismatch = await handleCmsAuthInternal(
      workerRequest({
        currentPassword: "current",
        password: "the replacement password",
        passwordConfirmation: "some different password"
      }),
      env(),
      successDependencies()
    );
    const reuseDependencies = successDependencies();
    reuseDependencies.verifyPassword = vi.fn().mockResolvedValue(true);
    const reuse = await handleCmsAuthInternal(
      workerRequest({
        currentPassword: "the current password",
        password: "the current password",
        passwordConfirmation: "the current password"
      }),
      env(),
      reuseDependencies
    );
    expect(weak?.status).toBe(400);
    expect(mismatch?.status).toBe(400);
    expect(reuse?.status).toBe(400);
  });

  it("returns no credential internals on success", async () => {
    const response = await handleCmsAuthInternal(
      workerRequest({
        currentPassword: "the current password",
        password: "the replacement password",
        passwordConfirmation: "the replacement password"
      }),
      env(),
      successDependencies()
    );
    const text = await response!.text();
    expect(JSON.parse(text)).toEqual({ ok: true, passwordChanged: true });
    expect(text).not.toMatch(/hash|algorithm|failed|locked|sessionVersion/i);
  });

  it("rejects a legacy-only Session before calling the Worker", async () => {
    const fetchImpl = vi.fn();
    const response = nodeResponse();
    await handleCmsPasswordChange(
      nodeRequest({
        body: {
          currentPassword: "the current password",
          password: "the replacement password",
          passwordConfirmation: "the replacement password"
        },
        headers: { cookie: "__Host-rcat_admin_proxy_session=legacy" }
      }),
      response,
      { env: { ...env(), CLOUDFLARE_ADMIN_API_URL: "https://worker.example.test" }, fetchImpl }
    );
    expect(response.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("clears both CMS cookies only after success and never clears the legacy cookie", async () => {
    const cookie = `${getCmsSessionCookieName()}=${sessionToken}; ${getCmsCsrfCookieName()}=${csrfToken}; __Host-rcat_admin_proxy_session=legacy`;
    const response = nodeResponse();
    await handleCmsPasswordChange(
      nodeRequest({
        body: {
          currentPassword: "the current password",
          password: "the replacement password",
          passwordConfirmation: "the replacement password"
        },
        headers: { cookie, [CMS_BROWSER_CSRF_HEADER]: csrfToken }
      }),
      response,
      {
        env: { ...env(), CLOUDFLARE_ADMIN_API_URL: "https://worker.example.test" },
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ ok: true, passwordChanged: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        ),
        nowMs: now.getTime()
      }
    );
    const setCookie = JSON.stringify(response.getHeader("Set-Cookie"));
    expect(response.statusCode).toBe(200);
    expect(setCookie).toContain(getCmsSessionCookieName());
    expect(setCookie).toContain(getCmsCsrfCookieName());
    expect(setCookie).not.toContain("rcat_admin_proxy_session");
  });

  it("does not clear cookies when the Worker rejects the current password", async () => {
    const response = nodeResponse();
    await handleCmsPasswordChange(
      nodeRequest({
        body: {
          currentPassword: "wrong current password",
          password: "the replacement password",
          passwordConfirmation: "the replacement password"
        },
        headers: {
          cookie: `${getCmsSessionCookieName()}=${sessionToken}; ${getCmsCsrfCookieName()}=${csrfToken}`,
          [CMS_BROWSER_CSRF_HEADER]: csrfToken
        }
      }),
      response,
      {
        env: { ...env(), CLOUDFLARE_ADMIN_API_URL: "https://worker.example.test" },
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "current password is invalid" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          })
        ),
        nowMs: now.getTime()
      }
    );
    expect(response.statusCode).toBe(401);
    expect(response.getHeader("Set-Cookie")).toBeUndefined();
  });
});
