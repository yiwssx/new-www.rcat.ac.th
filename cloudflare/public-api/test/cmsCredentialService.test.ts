// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { verifyCmsCredential } from "../src/auth/cmsCredentialService";
import { CMS_PASSWORD_ALGORITHM } from "../src/auth/cmsPassword";
import {
  getCmsLockoutDurationSeconds,
  type AdminAuthRepository,
  type FailedPasswordAttemptState
} from "../src/db/adminAuthRepository";
import type { AdminAuthUserRow, AdminCredentialRow } from "../src/db/schema";

const fixedNow = new Date("2026-07-20T03:00:00.000Z");
const password = " exact password value ";

const activeUser: AdminAuthUserRow = {
  id: "admin-user-1",
  email: "root@example.invalid",
  username: "root.admin",
  name: "Root Administrator",
  role: "admin",
  status: "active",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  created_by: "fixture",
  updated_by: "fixture",
  revision: 0,
  is_root: 1,
  must_change_password: 0,
  mfa_required: 1,
  session_version: 3,
  last_login_at: "2026-07-01T00:00:00.000Z"
};

const credential: AdminCredentialRow = {
  user_id: activeUser.id,
  password_hash: "$2a$04$.....................................................",
  password_algorithm: CMS_PASSWORD_ALGORITHM,
  password_changed_at: "2026-07-01T00:00:00.000Z",
  failed_login_count: 0,
  locked_until: "",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z"
};

function lockState(failureCount: number): FailedPasswordAttemptState {
  const seconds = getCmsLockoutDurationSeconds(failureCount);
  return {
    failedLoginCount: failureCount,
    lockedUntil: seconds === 0 ? "" : new Date(fixedNow.getTime() + seconds * 1000).toISOString()
  };
}

function makeRepository(
  options: {
    users?: AdminAuthUserRow[];
    credential?: AdminCredentialRow | null;
    nextFailureCount?: number;
  } = {}
) {
  const repository: AdminAuthRepository = {
    findAuthenticationUsersByIdentifier: vi.fn().mockResolvedValue(options.users ?? [activeUser]),
    findAuthenticationUsersByUsername: vi.fn().mockResolvedValue([]),
    getCredentialByUserId: vi
      .fn()
      .mockResolvedValue(Object.prototype.hasOwnProperty.call(options, "credential") ? options.credential : credential),
    getProtectedRootAccounts: vi.fn().mockResolvedValue([activeUser]),
    rootHasCredential: vi.fn().mockResolvedValue(true),
    createInitialRootCredential: vi.fn().mockResolvedValue(undefined),
    recordFailedPasswordAttempt: vi
      .fn()
      .mockResolvedValue(lockState(options.nextFailureCount ?? credential.failed_login_count + 1)),
    clearFailedPasswordAttempts: vi.fn().mockResolvedValue(undefined),
    writeSecurityAuditEntry: vi.fn().mockResolvedValue(undefined)
  };
  return repository;
}

function verifyWith(
  repository: AdminAuthRepository,
  options: {
    identifier?: string;
    submittedPassword?: string;
    passwordMatches?: boolean;
    dummy?: ReturnType<typeof vi.fn>;
    verifier?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const compareDummyPassword = options.dummy ?? vi.fn().mockResolvedValue(false);
  const verifyPassword = options.verifier ?? vi.fn().mockResolvedValue(options.passwordMatches ?? true);

  return {
    compareDummyPassword,
    verifyPassword,
    result: verifyCmsCredential({
      env: {},
      identifier: options.identifier ?? activeUser.email,
      password: options.submittedPassword ?? password,
      now: fixedNow,
      repository,
      compareDummyPassword,
      verifyPassword
    })
  };
}

describe("CMS credential verification service", () => {
  it("performs a dummy comparison for an unknown identifier without mutating the database", async () => {
    const repository = makeRepository({ users: [] });
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toEqual({ status: "invalid" });
    expect(attempt.compareDummyPassword).toHaveBeenCalledWith(password);
    expect(repository.recordFailedPasswordAttempt).not.toHaveBeenCalled();
  });

  it("performs a dummy comparison for a disabled account", async () => {
    const repository = makeRepository({ users: [{ ...activeUser, status: "disabled" }] });
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toEqual({ status: "invalid" });
    expect(attempt.compareDummyPassword).toHaveBeenCalledOnce();
    expect(repository.getCredentialByUserId).not.toHaveBeenCalled();
  });

  it("performs a dummy comparison for a missing credential", async () => {
    const repository = makeRepository({ credential: null });
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toEqual({ status: "invalid" });
    expect(attempt.compareDummyPassword).toHaveBeenCalledOnce();
  });

  it("fails closed with a dummy comparison for an unsupported algorithm", async () => {
    const repository = makeRepository({ credential: { ...credential, password_algorithm: "unsupported-v0" } });
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toEqual({ status: "invalid" });
    expect(attempt.compareDummyPassword).toHaveBeenCalledOnce();
    expect(attempt.verifyPassword).not.toHaveBeenCalled();
  });

  it("increments the failure count for a wrong password", async () => {
    const repository = makeRepository({ nextFailureCount: 1 });
    const attempt = verifyWith(repository, { passwordMatches: false });

    await expect(attempt.result).resolves.toEqual({ status: "invalid" });
    expect(repository.recordFailedPasswordAttempt).toHaveBeenCalledWith(activeUser.id, fixedNow);
  });

  it.each([
    [5, 30],
    [6, 2 * 60],
    [7, 15 * 60],
    [8, 30 * 60],
    [9, 30 * 60],
    [10, 60 * 60],
    [14, 60 * 60]
  ])("locks failure %i for %i seconds", async (nextFailureCount, retryAfterSeconds) => {
    const repository = makeRepository({ nextFailureCount });
    const attempt = verifyWith(repository, { passwordMatches: false });

    await expect(attempt.result).resolves.toEqual({ status: "locked", retryAfterSeconds });
  });

  it("clears failure state and returns only the safe identity after success", async () => {
    const repository = makeRepository();
    const attempt = verifyWith(repository, { passwordMatches: true });
    const result = await attempt.result;

    expect(repository.clearFailedPasswordAttempts).toHaveBeenCalledWith(activeUser.id, fixedNow);
    expect(result).toEqual({
      status: "success",
      identity: {
        id: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        username: activeUser.username,
        role: activeUser.role,
        isRoot: true,
        mustChangePassword: false,
        mfaRequired: true,
        sessionVersion: 3
      }
    });
    expect(JSON.stringify(result)).not.toMatch(/password_hash|passwordHash|\$2[aby]\$/);
  });

  it("does not create a Session or update last_login_at on success", async () => {
    const repository = makeRepository();
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toMatchObject({ status: "success" });
    expect(Object.keys(repository)).not.toContain("createSession");
    expect(Object.keys(repository)).not.toContain("updateLastLoginAt");
    expect(activeUser.last_login_at).toBe("2026-07-01T00:00:00.000Z");
  });

  it("normalizes identifier case and surrounding whitespace", async () => {
    const repository = makeRepository();
    const attempt = verifyWith(repository, { identifier: "  ROOT@EXAMPLE.INVALID  " });

    await expect(attempt.result).resolves.toMatchObject({ status: "success" });
    expect(repository.findAuthenticationUsersByIdentifier).toHaveBeenCalledWith("root@example.invalid");
  });

  it("does not normalize password whitespace", async () => {
    const repository = makeRepository();
    const verifier = vi.fn().mockResolvedValue(true);
    const attempt = verifyWith(repository, { submittedPassword: password, verifier });

    await expect(attempt.result).resolves.toMatchObject({ status: "success" });
    expect(verifier).toHaveBeenCalledWith(password, credential.password_hash, credential.password_algorithm);
  });

  it("fails closed with a dummy comparison for an ambiguous identity", async () => {
    const repository = makeRepository({
      users: [activeUser, { ...activeUser, id: "admin-user-2", email: "second@example.invalid" }]
    });
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toEqual({ status: "invalid" });
    expect(attempt.compareDummyPassword).toHaveBeenCalledOnce();
    expect(repository.getCredentialByUserId).not.toHaveBeenCalled();
  });

  it("returns a bounded lock result for an already locked credential after a dummy comparison", async () => {
    const repository = makeRepository({
      credential: {
        ...credential,
        locked_until: new Date(fixedNow.getTime() + 2 * 60 * 60 * 1000).toISOString()
      }
    });
    const attempt = verifyWith(repository);

    await expect(attempt.result).resolves.toEqual({ status: "locked", retryAfterSeconds: 60 * 60 });
    expect(attempt.compareDummyPassword).toHaveBeenCalledOnce();
    expect(attempt.verifyPassword).not.toHaveBeenCalled();
  });
});
