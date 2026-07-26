// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const authenticateCmsSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../src/auth/cmsSessionService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/cmsSessionService")>();
  return { ...actual, authenticateCmsSession: authenticateCmsSessionMock };
});

import { ROLE_CAPABILITIES, type AdminCapability } from "../src/auth/adminCapabilities";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../src/routes/cmsAuthInternal";
import worker from "../src/index";

const cmsProxySecret = "phase-4-cms-proxy-secret-repeated-000000000000";
const cmsSessionToken = "S".repeat(43);
const cmsCsrfToken = "C".repeat(43);

function dbWithPrepare(prepare = vi.fn()) {
  return { prepare } as unknown as D1Database;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  revision: number;
}

function createUserDb(initialUsers: UserRow[]) {
  const users = structuredClone(initialUsers);
  const prepare = vi.fn((query: string) => {
    let bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings = values;
        return statement;
      },
      async first<T>() {
        if (/WHERE id = \?/i.test(query)) {
          return (users.find((user) => user.id === bindings[0]) ?? null) as T | null;
        }
        if (/WHERE email = \? COLLATE NOCASE/i.test(query)) {
          const email = String(bindings[0] ?? "").toLowerCase();
          return (users.find((user) => user.email.toLowerCase() === email) ?? null) as T | null;
        }
        return null;
      },
      async all<T>() {
        return { results: [] as T[], success: true, meta: {} };
      },
      async run<T>() {
        if (/UPDATE app_admin_users/i.test(query)) {
          const [email, name, role, status, updatedAt, updatedBy, id] = bindings;
          const user = users.find((candidate) => candidate.id === id);
          if (!user) return { results: [] as T[], success: true, meta: { changes: 0 } };
          Object.assign(user, {
            email,
            name,
            role,
            status,
            updated_at: updatedAt,
            updated_by: updatedBy,
            revision: user.revision + 1
          });
          return { results: [] as T[], success: true, meta: { changes: 1 } };
        }
        return { results: [] as T[], success: true, meta: { changes: 0 } };
      }
    };
    return statement;
  });

  return { db: { prepare } as unknown as D1Database, prepare, users };
}

function cmsEnv(db: D1Database) {
  return {
    DB: db,
    CMS_AUTH_PROXY_SECRET: cmsProxySecret
  };
}

function cmsRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://worker.example.test${path}`, {
    ...init,
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: cmsProxySecret,
      [CMS_SESSION_TOKEN_HEADER]: cmsSessionToken,
      [CMS_CLIENT_IP_HEADER]: "203.0.113.40",
      [CMS_USER_AGENT_HEADER]: "test-agent",
      ...(init.method && init.method !== "GET" ? { [CMS_CSRF_TOKEN_HEADER]: cmsCsrfToken } : {}),
      ...init.headers
    }
  });
}

function currentCmsIdentity(
  role: "admin" | "editor" | "viewer" | string,
  id = "cms-user-1",
  email = "cms-user@example.invalid"
) {
  return {
    status: "authenticated" as const,
    identity: {
      id,
      email,
      name: "CMS User",
      username: "cms.user",
      role,
      isRoot: role === "admin",
      sessionId: "must-not-be-exposed",
      sessionVersion: 7,
      reauthenticatedAt: new Date().toISOString(),
      mfaVerifiedAt: role === "admin" ? new Date().toISOString() : ""
    }
  };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

afterEach(() => {
  authenticateCmsSessionMock.mockReset();
  vi.restoreAllMocks();
});

describe("Worker Admin capability enforcement", () => {
  it.each(["admin", "editor", "viewer"] as const)(
    "returns a fresh, exact, sorted, no-store %s capability list without sensitive state",
    async (role) => {
      const prepare = vi.fn();
      authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity(role));
      const response = await worker.fetch(
        cmsRequest("/api/admin/capabilities", {
          headers: { "X-RCAT-Admin-Capabilities": "backup.download,users.delete" }
        }),
        cmsEnv(dbWithPrepare(prepare))
      );
      const body = await json(response);
      const expected = [...ROLE_CAPABILITIES[role]].sort();

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(body).toEqual({ role, capabilities: expected });
      expect(new Set(body.capabilities as AdminCapability[]).size).toBe(expected.length);
      expect(JSON.stringify(body)).not.toMatch(/sessionId|sessionVersion|token|passwordHash|credentialConfigured/i);
      expect(prepare).not.toHaveBeenCalled();
    }
  );

  it("uses the current CMS D1 identity role on every request and ignores legacy role and capability headers", async () => {
    const prepare = vi.fn();
    const env = cmsEnv(dbWithPrepare(prepare));
    const requestHeaders = {
      "X-RCAT-Admin-Proxy-Email": "attacker@example.invalid",
      "X-RCAT-Admin-Proxy-Role": "admin",
      "X-RCAT-Admin-Capabilities": "backup.download"
    };

    authenticateCmsSessionMock.mockResolvedValueOnce(currentCmsIdentity("viewer"));
    const viewerResponse = await worker.fetch(cmsRequest("/api/admin/capabilities", { headers: requestHeaders }), env);
    authenticateCmsSessionMock.mockResolvedValueOnce(currentCmsIdentity("editor"));
    const editorResponse = await worker.fetch(cmsRequest("/api/admin/capabilities", { headers: requestHeaders }), env);

    await expect(json(viewerResponse)).resolves.toEqual({
      role: "viewer",
      capabilities: [...ROLE_CAPABILITIES.viewer].sort()
    });
    await expect(json(editorResponse)).resolves.toEqual({
      role: "editor",
      capabilities: [...ROLE_CAPABILITIES.editor].sort()
    });
    expect(authenticateCmsSessionMock).toHaveBeenCalledTimes(2);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("accepts the CMS identity and rejects old identity headers alone", async () => {
    const prepare = vi.fn();
    const db = dbWithPrepare(prepare);
    authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity("editor"));

    const cmsCapabilities = await worker.fetch(cmsRequest("/api/admin/capabilities"), cmsEnv(db));
    const retiredIdentity = await worker.fetch(
      new Request("https://worker.example.test/api/admin/capabilities", {
        headers: {
          "X-RCAT-Admin-Smoke-Token": "retired",
          "X-RCAT-Admin-Proxy-Email": "editor@example.invalid",
          "X-RCAT-Admin-Proxy-Role": "editor"
        }
      }),
      cmsEnv(db)
    );
    const cmsDenied = await worker.fetch(
      cmsRequest("/api/admin/external-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "blocked", href: "/blocked" })
      }),
      cmsEnv(db)
    );
    expect(cmsCapabilities.status).toBe(200);
    expect(retiredIdentity.status).toBe(403);
    expect(cmsDenied.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("restricts CMS Editor self-service to the D1-authenticated user ID and the name field", async () => {
    const now = "2026-07-22T00:00:00.000Z";
    const state = createUserDb([
      {
        id: "editor-1",
        email: "cms-user@example.invalid",
        name: "Editor One",
        role: "editor",
        status: "active",
        created_at: now,
        updated_at: now,
        created_by: "fixture",
        updated_by: "fixture",
        revision: 0
      },
      {
        id: "viewer-1",
        email: "viewer@example.invalid",
        name: "Viewer One",
        role: "viewer",
        status: "active",
        created_at: now,
        updated_at: now,
        created_by: "fixture",
        updated_by: "fixture",
        revision: 0
      }
    ]);
    authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity("editor", "editor-1"));

    const safe = await worker.fetch(
      cmsRequest("/api/admin/users/editor-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Editor" })
      }),
      cmsEnv(state.db)
    );
    expect(safe.status).toBe(200);
    expect(state.users[0]).toMatchObject({
      id: "editor-1",
      email: "cms-user@example.invalid",
      name: "Updated Editor",
      role: "editor",
      status: "active"
    });

    for (const body of [
      { email: "changed@example.invalid" },
      { role: "admin" },
      { status: "disabled" },
      { username: "changed.user" },
      { is_root: 1 },
      { session_version: 99 }
    ]) {
      const denied = await worker.fetch(
        cmsRequest("/api/admin/users/editor-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }),
        cmsEnv(state.db)
      );
      expect(denied.status, JSON.stringify(body)).toBe(403);
    }

    const callsBeforeOtherUser = state.prepare.mock.calls.length;
    const otherUser = await worker.fetch(
      cmsRequest("/api/admin/users/viewer-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Must not change" })
      }),
      cmsEnv(state.db)
    );
    expect(otherUser.status).toBe(403);
    expect(state.prepare).toHaveBeenCalledTimes(callsBeforeOtherUser);
    expect(state.users[1].name).toBe("Viewer One");

    authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity("viewer", "viewer-1", "viewer@example.invalid"));
    const viewerMe = await worker.fetch(cmsRequest("/api/admin/users/me"), cmsEnv(state.db));
    expect(viewerMe.status).toBe(200);
    await expect(json(viewerMe)).resolves.toMatchObject({
      item: expect.objectContaining({ id: "viewer-1", email: "viewer@example.invalid" })
    });
    const callsBeforeViewerUpdate = state.prepare.mock.calls.length;
    const viewerUpdate = await worker.fetch(
      cmsRequest("/api/admin/users/viewer-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Viewer change" })
      }),
      cmsEnv(state.db)
    );
    expect(viewerUpdate.status).toBe(403);
    expect(state.prepare).toHaveBeenCalledTimes(callsBeforeViewerUpdate);
  });

  it.each([
    ["viewer content create", "viewer", "POST", "/api/admin/content"],
    ["viewer content publish", "viewer", "POST", "/api/admin/content/publish-pending"],
    ["viewer carousel order", "viewer", "PUT", "/api/admin/carousel/order"],
    ["editor backup", "editor", "GET", "/api/admin/backup/download"],
    ["viewer all-user read", "viewer", "GET", "/api/admin/users"]
  ])("denies %s before D1, handler body processing, or external fetch", async (_label, role, method, path) => {
    const prepare = vi.fn();
    const externalFetch = vi.spyOn(globalThis, "fetch");
    authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity(role));
    const response = await worker.fetch(
      cmsRequest(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : "not-json-and-must-not-be-read"
      }),
      cmsEnv(dbWithPrepare(prepare))
    );

    expect(response.status).toBe(403);
    await expect(json(response)).resolves.toMatchObject({ error: "required permission is missing" });
    expect(prepare).not.toHaveBeenCalled();
    expect(externalFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "/api/admin/users/user-1/invitations"],
    ["DELETE", "/api/admin/users/user-1/invitations"],
    ["POST", "/api/admin/users/user-1/password-reset"],
    ["POST", "/api/admin/users/user-1/revoke-sessions"]
  ])("denies Editor lifecycle action %s %s before lifecycle SQL", async (method, path) => {
    const prepare = vi.fn();
    authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity("editor"));
    const response = await worker.fetch(cmsRequest(path, { method }), cmsEnv(dbWithPrepare(prepare)));
    expect(response.status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("fails closed for invalid roles and unknown Admin routes without executing a handler", async () => {
    const invalidPrepare = vi.fn();
    authenticateCmsSessionMock.mockResolvedValueOnce(currentCmsIdentity("owner"));
    const invalid = await worker.fetch(cmsRequest("/api/admin/capabilities"), cmsEnv(dbWithPrepare(invalidPrepare)));
    const unknownPrepare = vi.fn();
    authenticateCmsSessionMock.mockResolvedValueOnce(currentCmsIdentity("admin"));
    const unknown = await worker.fetch(cmsRequest("/api/admin/not-a-route"), cmsEnv(dbWithPrepare(unknownPrepare)));

    expect(invalid.status).toBe(403);
    expect(unknown.status).toBe(404);
    expect(invalidPrepare).not.toHaveBeenCalled();
    expect(unknownPrepare).not.toHaveBeenCalled();
  });

  it("returns the safe 404 contract for the retired Root bootstrap path", async () => {
    const prepare = vi.fn();
    authenticateCmsSessionMock.mockResolvedValue(currentCmsIdentity("admin"));
    const response = await worker.fetch(
      cmsRequest("/api/admin/auth/bootstrap-root-credential", { method: "POST" }),
      cmsEnv(dbWithPrepare(prepare))
    );

    expect(response.status).toBe(404);
    await expect(json(response)).resolves.toMatchObject({ error: "not found" });
    expect(prepare).not.toHaveBeenCalled();
  });
});
