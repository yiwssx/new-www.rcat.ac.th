// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { hashCmsClientIp, hashCmsCsrfToken, hashCmsSessionToken, hashCmsUserAgent } from "../src/auth/cmsSessionCrypto";
import {
  ADMIN_AUTH_USER_ROW_COLUMNS,
  ADMIN_SESSION_ROW_COLUMNS,
  type AdminAuthUserRow,
  type AdminSessionRow
} from "../src/db/schema";
import type { Env } from "../src/env";
import worker from "../src/index";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../src/routes/cmsAuthInternal";

const authorizationPath = "/api/admin/media-bridge-authorization";
const proxySecret = "test-only-media-bridge-secret-repeated-000000000000";
const sessionToken = "S".repeat(43);
const realCsrfToken = "C".repeat(43);
const fabricatedCsrfToken = "F".repeat(43);
const clientIp = "203.0.113.91";
const userAgent = "media-bridge-authorization-test";

interface TestDatabase {
  db: D1Database;
  queries: string[];
  writeCalls: ReturnType<typeof vi.fn>;
}

function makeRequest({
  csrfToken = realCsrfToken,
  method = "POST",
  token = sessionToken
}: {
  csrfToken?: string;
  method?: string;
  token?: string;
} = {}) {
  return new Request(`https://worker.example.invalid${authorizationPath}`, {
    method,
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
      ...(token ? { [CMS_SESSION_TOKEN_HEADER]: token } : {}),
      ...(csrfToken ? { [CMS_CSRF_TOKEN_HEADER]: csrfToken } : {}),
      [CMS_CLIENT_IP_HEADER]: clientIp,
      [CMS_USER_AGENT_HEADER]: userAgent
    }
  });
}

async function makeDatabase(role: "admin" | "viewer" = "admin"): Promise<TestDatabase> {
  const now = new Date();
  const user: AdminAuthUserRow = {
    id: "media-bridge-user",
    email: "media-bridge-user@example.invalid",
    name: "Media Bridge User",
    username: "media.bridge",
    role,
    status: "active",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    created_by: "test",
    updated_by: "test",
    revision: 0,
    is_root: 0,
    must_change_password: 0,
    mfa_required: 0,
    session_version: 4,
    last_login_at: now.toISOString()
  };
  const session: AdminSessionRow = {
    id: "must-never-appear-in-response",
    user_id: user.id,
    token_hash: await hashCmsSessionToken(sessionToken),
    csrf_token_hash: await hashCmsCsrfToken(realCsrfToken),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    idle_expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    absolute_expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    session_version: user.session_version,
    revoked_at: "",
    ip_hash: await hashCmsClientIp(clientIp, proxySecret),
    user_agent_hash: await hashCmsUserAgent(userAgent, proxySecret),
    reauthenticated_at: now.toISOString(),
    mfa_verified_at: ""
  };
  const joinedRow = {
    ...Object.fromEntries(ADMIN_SESSION_ROW_COLUMNS.map((column) => [`session_${column}`, session[column]])),
    ...Object.fromEntries(ADMIN_AUTH_USER_ROW_COLUMNS.map((column) => [`user_${column}`, user[column]])),
    effective_mfa: 0
  };
  const queries: string[] = [];
  const writeCalls = vi.fn();
  const prepare = vi.fn((query: string) => {
    queries.push(query);
    let bindings: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        bindings = values;
        return statement;
      },
      async first<T>() {
        return (bindings[0] === session.token_hash ? joinedRow : null) as T | null;
      },
      async all<T>() {
        return { results: [] as T[], success: true, meta: {} };
      },
      async run<T>() {
        writeCalls(query, bindings);
        return { results: [] as T[], success: true, meta: { changes: 0 } };
      }
    };
    return statement;
  });

  return {
    db: { prepare } as unknown as D1Database,
    queries,
    writeCalls
  };
}

function makeEnv(db: D1Database): Env {
  return {
    DB: db,
    CMS_AUTH_PROXY_SECRET: proxySecret
  };
}

describe("POST /api/admin/media-bridge-authorization", () => {
  it("authorizes the real D1-bound CSRF token without writing business or Session data", async () => {
    const database = await makeDatabase();
    const response = await worker.fetch(makeRequest(), makeEnv(database.db));

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
    expect(database.queries).toHaveLength(1);
    expect(database.queries[0]).toMatch(/^\s*SELECT\b/i);
    expect(database.queries[0]).toContain("FROM admin_sessions AS s");
    expect(database.writeCalls).not.toHaveBeenCalled();
  });

  it("rejects a valid-looking fabricated CSRF token against the stored D1 Session hash", async () => {
    const database = await makeDatabase();
    const response = await worker.fetch(makeRequest({ csrfToken: fabricatedCsrfToken }), makeEnv(database.db));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: "CSRF validation failed",
      resource: "admin-structured-data"
    });
    expect(database.writeCalls).not.toHaveBeenCalled();
  });

  it("requires media.manage rather than accepting a media.read-only role", async () => {
    const database = await makeDatabase("viewer");
    const response = await worker.fetch(makeRequest(), makeEnv(database.db));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "required permission is missing",
      resource: "media-bridge-authorization"
    });
    expect(database.writeCalls).not.toHaveBeenCalled();
  });

  it("rejects a missing Session before reading D1", async () => {
    const database = await makeDatabase();
    const response = await worker.fetch(makeRequest({ token: "" }), makeEnv(database.db));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "CMS session is invalid or expired"
    });
    expect(database.queries).toEqual([]);
    expect(database.writeCalls).not.toHaveBeenCalled();
  });

  it("is method-finite and never turns GET into a mutation authorization", async () => {
    const database = await makeDatabase();
    const response = await worker.fetch(makeRequest({ csrfToken: "", method: "GET" }), makeEnv(database.db));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toContain("POST");
    expect(database.writeCalls).not.toHaveBeenCalled();
  });

  it("does not expose a Session ID, token, CSRF token, user data, or capability list", async () => {
    const database = await makeDatabase();
    const response = await worker.fetch(makeRequest(), makeEnv(database.db));
    const body = await response.text();

    expect(response.status).toBe(204);
    expect(body).toBe("");
    expect(body).not.toContain("must-never-appear-in-response");
    expect(body).not.toContain(sessionToken);
    expect(body).not.toContain(realCsrfToken);
    expect(body).not.toContain("media-bridge-user@example.invalid");
    expect(body).not.toContain("media.manage");
  });
});
