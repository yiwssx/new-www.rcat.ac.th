// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AdminIdentity } from "../src/auth/adminAccess";
import { CMS_PASSWORD_ALGORITHM, verifyCmsPassword } from "../src/auth/cmsPassword";
import {
  AdminAuthRepositoryConflict,
  createAdminAuthRepository,
  type AdminAuthRepository,
  type InitialRootCredentialInput
} from "../src/db/adminAuthRepository";
import type { AdminAuthUserRow, AdminCredentialRow, AdminAuditLogRow } from "../src/db/schema";
import worker from "../src/index";
import { handleAdminAuth } from "../src/routes/adminAuth";
import adminWriteSource from "../src/routes/adminWrite.ts?raw";
import loginHandlerSource from "../../../server/adminProxy/handlers.mjs?raw";
import loginSessionSource from "../../../server/adminProxy/session.mjs?raw";

const endpoint = "https://worker.example.test/api/admin/auth/bootstrap-root-credential";
const rawPassword = "phase two password value";
const fakePasswordHash = "$2a$04$.....................................................";
const fixedNow = new Date("2026-07-20T04:00:00.000Z");

const rootUser: AdminAuthUserRow = {
  id: "root-user",
  email: "root@example.invalid",
  username: null,
  name: "Root Administrator",
  role: "admin",
  status: "active",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  created_by: "fixture",
  updated_by: "fixture",
  revision: 7,
  is_root: 1,
  must_change_password: 1,
  mfa_required: 1,
  session_version: 4,
  last_login_at: "2026-07-10T00:00:00.000Z"
};

function identity(role: AdminIdentity["role"] = "admin", email = rootUser.email): AdminIdentity {
  return { actor: email.toLowerCase(), email, role, mode: "smoke-token" };
}

function request(body: Record<string, unknown> = {}, method = "POST") {
  return new Request(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body:
      method === "POST" ? JSON.stringify({ password: rawPassword, passwordConfirmation: rawPassword, ...body }) : null
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function createRouteRepository(
  options: {
    roots?: AdminAuthUserRow[];
    credentialConfigured?: boolean;
    usernameMatches?: AdminAuthUserRow[];
    failAtomic?: boolean;
  } = {}
) {
  const state: {
    credential: Pick<AdminCredentialRow, "user_id" | "password_hash" | "password_algorithm"> | null;
    user: AdminAuthUserRow | null;
    audits: AdminAuditLogRow[];
  } = {
    credential: options.credentialConfigured
      ? { user_id: rootUser.id, password_hash: fakePasswordHash, password_algorithm: CMS_PASSWORD_ALGORITHM }
      : null,
    user: structuredClone((options.roots ?? [rootUser])[0] ?? null),
    audits: []
  };

  const repository: AdminAuthRepository = {
    findAuthenticationUsersByIdentifier: vi.fn().mockResolvedValue([]),
    findAuthenticationUsersByUsername: vi.fn().mockResolvedValue(options.usernameMatches ?? []),
    getCredentialByUserId: vi.fn().mockResolvedValue(null),
    getProtectedRootAccounts: vi.fn().mockResolvedValue(options.roots ?? [rootUser]),
    rootHasCredential: vi.fn().mockImplementation(async () => Boolean(state.credential)),
    createInitialRootCredential: vi.fn().mockImplementation(async (input: InitialRootCredentialInput) => {
      if (options.failAtomic) {
        throw new Error("simulated atomic batch failure");
      }

      if (state.credential) {
        throw new AdminAuthRepositoryConflict("credential_configured");
      }

      const nextUser = structuredClone(state.user);

      if (!nextUser || nextUser.id !== input.rootUserId) {
        throw new AdminAuthRepositoryConflict("root_unavailable");
      }

      if (input.updateUsername) {
        nextUser.username = input.username;
      }

      nextUser.must_change_password = 0;
      nextUser.updated_at = input.now.toISOString();
      nextUser.updated_by = input.actor;
      nextUser.revision += 1;

      const nextCredential = {
        user_id: input.rootUserId,
        password_hash: input.passwordHash,
        password_algorithm: input.passwordAlgorithm
      };
      const nextAudit: AdminAuditLogRow = {
        id: "audit-fixture",
        entity_type: "admin-user",
        entity_id: input.rootUserId,
        action: "credential.bootstrap",
        actor: input.actor,
        created_at: input.now.toISOString(),
        metadata_json: JSON.stringify({ algorithm: input.passwordAlgorithm, root: true })
      };

      state.user = nextUser;
      state.credential = nextCredential;
      state.audits.push(nextAudit);
    }),
    recordFailedPasswordAttempt: vi.fn().mockResolvedValue(null),
    clearFailedPasswordAttempts: vi.fn().mockResolvedValue(undefined),
    writeSecurityAuditEntry: vi.fn().mockResolvedValue(undefined)
  };

  return { repository, state };
}

function callRoute(
  repository: AdminAuthRepository,
  options: {
    body?: Record<string, unknown>;
    adminIdentity?: AdminIdentity;
    hashPassword?: (password: string) => Promise<string>;
    method?: string;
  } = {}
) {
  return handleAdminAuth(
    request(options.body, options.method),
    {},
    ["auth", "bootstrap-root-credential"],
    options.adminIdentity ?? identity(),
    {
      repository,
      hashPassword: options.hashPassword ?? vi.fn().mockResolvedValue(fakePasswordHash),
      now: () => fixedNow
    }
  ) as Promise<Response>;
}

describe("Root CMS credential bootstrap route", () => {
  it("allows the authenticated Root Admin to bootstrap exactly once", async () => {
    const { repository, state } = createRouteRepository();
    const first = await callRoute(repository, { body: { username: "ROOT.Admin" } });
    const second = await callRoute(repository);

    expect(first.status).toBe(200);
    await expect(readJson(first)).resolves.toEqual({
      ok: true,
      credentialConfigured: true,
      user: { id: rootUser.id, email: rootUser.email, username: "root.admin", isRoot: true }
    });
    expect(second.status).toBe(409);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].action).toBe("credential.bootstrap");
  });

  it.each(["editor", "viewer"] as const)("rejects an authenticated %s", async (role) => {
    const prepare = vi.fn(() => {
      throw new Error("authorization denial must precede D1 access");
    });
    const response = await worker.fetch(
      new Request(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RCAT-Admin-Smoke-Token": "phase-2-smoke-token",
          "X-RCAT-Admin-Proxy-Email": `${role}@example.invalid`,
          "X-RCAT-Admin-Proxy-Role": role
        },
        body: JSON.stringify({ password: rawPassword, passwordConfirmation: rawPassword })
      }),
      {
        DB: { prepare } as unknown as D1Database,
        ADMIN_WRITE_PREVIEW_ENABLED: "true",
        ADMIN_WRITE_SMOKE_ENABLED: "true",
        ADMIN_WRITE_SMOKE_TOKEN: "phase-2-smoke-token",
        ENVIRONMENT: "preview"
      }
    );

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toMatchObject({ error: "required permission is missing" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects an ordinary Admin that does not own the Root identity", async () => {
    const { repository } = createRouteRepository();
    const response = await callRoute(repository, { adminIdentity: identity("admin", "ordinary@example.invalid") });

    expect(response.status).toBe(403);
    expect(repository.createInitialRootCredential).not.toHaveBeenCalled();
  });

  it("compares the authenticated Root email case-insensitively", async () => {
    const { repository } = createRouteRepository();
    const response = await callRoute(repository, { adminIdentity: identity("admin", "ROOT@EXAMPLE.INVALID") });

    expect(response.status).toBe(200);
  });

  it("fails closed when the Root is missing or duplicated", async () => {
    const missing = createRouteRepository({ roots: [] });
    const duplicated = createRouteRepository({
      roots: [rootUser, { ...rootUser, id: "second-root", email: "second-root@example.invalid" }]
    });

    expect((await callRoute(missing.repository)).status).toBe(409);
    expect((await callRoute(duplicated.repository)).status).toBe(409);
  });

  it.each([
    ["disabled Root", { status: "disabled" as const }],
    ["demoted Root", { role: "editor" as const }]
  ])("fails closed for a %s", async (_label, override) => {
    const { repository } = createRouteRepository({ roots: [{ ...rootUser, ...override }] });
    expect((await callRoute(repository)).status).toBe(409);
  });

  it("rejects mismatched password confirmation without trimming", async () => {
    const { repository } = createRouteRepository();
    const response = await callRoute(repository, { body: { passwordConfirmation: `${rawPassword} ` } });

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({ code: "confirmation_mismatch" });
  });

  it("returns a structured policy error for a weak password", async () => {
    const { repository } = createRouteRepository();
    const response = await callRoute(repository, { body: { password: "weak", passwordConfirmation: "weak" } });

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({ code: "too_short" });
  });

  it("rejects a duplicate username case-insensitively", async () => {
    const { repository } = createRouteRepository({ usernameMatches: [{ ...rootUser, id: "other-admin" }] });
    const response = await callRoute(repository, { body: { username: "Taken.Name" } });

    expect(response.status).toBe(409);
    expect(repository.findAuthenticationUsersByUsername).toHaveBeenCalledWith("taken.name");
  });

  it("rejects an already configured Root credential", async () => {
    const { repository } = createRouteRepository({ credentialConfigured: true });
    expect((await callRoute(repository)).status).toBe(409);
  });

  it("stores the versioned algorithm and never passes the raw password into audit data", async () => {
    const { repository, state } = createRouteRepository();
    await callRoute(repository);
    const input = vi.mocked(repository.createInitialRootCredential).mock.calls[0][0];

    expect(input.passwordAlgorithm).toBe("bcrypt-sha384-v1");
    expect(input.passwordHash).toBe(fakePasswordHash);
    expect(input.passwordHash).not.toBe(rawPassword);
    expect(JSON.stringify(state.audits)).not.toContain(rawPassword);
    expect(JSON.stringify(state.audits)).not.toContain(fakePasswordHash);
  });

  it("returns no credential internals and sets no cookie", async () => {
    const { repository } = createRouteRepository();
    const response = await callRoute(repository);
    const responseText = await response.text();

    expect(responseText).not.toMatch(/password|algorithm|failedLogin|lockedUntil|sessionVersion|revision|\$2[aby]\$/i);
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it("preserves protected account and session fields", async () => {
    const { repository, state } = createRouteRepository();
    const before = structuredClone(state.user);
    await callRoute(repository, { body: { username: "root.admin" } });

    expect(state.user).toMatchObject({
      role: before?.role,
      status: before?.status,
      is_root: before?.is_root,
      mfa_required: before?.mfa_required,
      session_version: before?.session_version,
      last_login_at: before?.last_login_at
    });
    expect(state.user?.must_change_password).toBe(0);
    expect(state.user?.revision).toBe((before?.revision ?? 0) + 1);
  });

  it("leaves credential, user, and audit state unchanged when the atomic write fails", async () => {
    const { repository, state } = createRouteRepository({ failAtomic: true });
    const before = structuredClone(state);

    await expect(callRoute(repository)).rejects.toThrow("simulated atomic batch failure");
    expect(state).toEqual(before);
  });

  it("uses one D1 batch for credential creation, Root update, and the audit entry", async () => {
    const prepared: Array<{ query: string; bindings: unknown[] }> = [];
    const batch = vi.fn().mockResolvedValue([]);
    const db = {
      prepare(query: string) {
        const statement = {
          query,
          bindings: [] as unknown[],
          bind(...bindings: unknown[]) {
            this.bindings = bindings;
            prepared.push(this);
            return this;
          }
        };
        return statement;
      },
      batch
    } as unknown as D1Database;
    const repository = createAdminAuthRepository({ DB: db });

    await repository.createInitialRootCredential({
      rootUserId: rootUser.id,
      passwordHash: fakePasswordHash,
      passwordAlgorithm: CMS_PASSWORD_ALGORITHM,
      username: "root.admin",
      updateUsername: true,
      actor: rootUser.email,
      now: fixedNow
    });

    expect(batch).toHaveBeenCalledOnce();
    expect(batch.mock.calls[0][0]).toHaveLength(3);
    expect(prepared.map((entry) => entry.query)).toEqual([
      expect.stringMatching(/INSERT INTO admin_credentials/i),
      expect.stringMatching(/UPDATE app_admin_users/i),
      expect.stringMatching(/INSERT INTO admin_audit_log/i)
    ]);
    expect(JSON.stringify(prepared[2].bindings)).not.toContain(rawPassword);
    expect(JSON.stringify(prepared[2].bindings)).not.toContain(fakePasswordHash);
  });

  it("supports one authenticated Worker bootstrap path with the real password module", async () => {
    const prepared: Array<{ query: string; bindings: unknown[] }> = [];
    const db = {
      prepare(query: string) {
        const statement = {
          query,
          bindings: [] as unknown[],
          bind(...bindings: unknown[]) {
            this.bindings = bindings;
            prepared.push(this);
            return this;
          },
          async all() {
            return { results: /WHERE is_root = 1/i.test(query) ? [rootUser] : [], success: true, meta: {} };
          },
          async first() {
            return null;
          }
        };
        return statement;
      },
      async batch(statements: unknown[]) {
        return statements.map(() => ({ success: true, meta: { changes: 1 }, results: [] }));
      }
    } as unknown as D1Database;
    const response = await worker.fetch(
      new Request(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RCAT-Admin-Smoke-Token": "phase-2-smoke-token",
          "X-RCAT-Admin-Proxy-Email": rootUser.email,
          "X-RCAT-Admin-Proxy-Role": "admin"
        },
        body: JSON.stringify({ password: rawPassword, passwordConfirmation: rawPassword })
      }),
      {
        DB: db,
        ADMIN_WRITE_PREVIEW_ENABLED: "true",
        ADMIN_WRITE_SMOKE_ENABLED: "true",
        ADMIN_WRITE_SMOKE_TOKEN: "phase-2-smoke-token",
        ENVIRONMENT: "preview"
      }
    );
    const credentialInsert = prepared.find((entry) => /INSERT INTO admin_credentials/i.test(entry.query));
    const storedHash = String(credentialInsert?.bindings[2] ?? "");
    const storedAlgorithm = String(credentialInsert?.bindings[3] ?? "");

    expect(response.status).toBe(200);
    expect(storedHash).toMatch(/^\$2[aby]\$12\$/);
    expect(storedAlgorithm).toBe(CMS_PASSWORD_ALGORITHM);
    await expect(verifyCmsPassword(rawPassword, storedHash, storedAlgorithm)).resolves.toBe(true);
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it("is integrated only behind the authenticated Admin write route and leaves legacy Login modules unchanged", () => {
    expect(adminWriteSource).toMatch(
      /authenticateAdminRequest[\s\S]+resolveAdminRoutePolicy[\s\S]+requireAdminCapability[\s\S]+handleAdminAuth/
    );
    expect(adminWriteSource).not.toMatch(/identity\.role\s*(?:===|!==)/);
    expect(adminWriteSource).not.toMatch(/verifyCmsCredential|hashCmsPassword/);
    expect(loginHandlerSource).not.toMatch(/bootstrap-root-credential|verifyCmsCredential|admin_credentials/);
    expect(loginSessionSource).not.toMatch(/bootstrap-root-credential|verifyCmsCredential|admin_credentials/);
  });
});
