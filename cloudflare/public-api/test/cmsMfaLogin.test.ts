// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_MFA_CHALLENGE_TOKEN_HEADER,
  CMS_NEW_CSRF_TOKEN_HEADER,
  CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER,
  CMS_NEW_SESSION_TOKEN_HEADER,
  handleCmsAuthInternal
} from "../src/routes/cmsAuthInternal";
import type { AdminMfaRepository } from "../src/db/adminMfaRepository";
import type { AdminAuthUserRow, AdminMfaChallengeRow } from "../src/db/schema";
import { encryptTotpSecret } from "../src/auth/cmsMfaCrypto";
import { generateTotpCode } from "../src/auth/cmsTotp";

const now = new Date("2026-07-23T03:00:00.000Z");
const encryptionKey = "A".repeat(43);
const encryptionKeyVersion = "test-v1";
const totpSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const user: AdminAuthUserRow = {
  id: "admin-user-1",
  email: "admin@example.invalid",
  name: "Admin",
  username: "admin",
  role: "admin" as const,
  status: "active" as const,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  created_by: "fixture",
  updated_by: "fixture",
  revision: 1,
  is_root: 0 as const,
  must_change_password: 0 as const,
  mfa_required: 0 as const,
  session_version: 4,
  last_login_at: ""
};
const factor = {
  user_id: user.id,
  encrypted_secret: "ciphertext",
  iv: "iv",
  key_version: "v1",
  state: "enabled" as const,
  created_at: now.toISOString(),
  enabled_at: now.toISOString(),
  updated_at: now.toISOString(),
  last_used_step: 1
};

function repository(configured: boolean, storedUser: AdminAuthUserRow = user) {
  return {
    getUserState: vi.fn(async () => ({
      user: storedUser,
      factor: configured ? factor : null,
      recoveryCodesRemaining: configured ? 10 : 0
    })),
    createChallenge: vi.fn(async () => undefined)
  } as unknown as AdminMfaRepository;
}

function loginRequest() {
  return new Request("https://worker.invalid/api/internal/cms-auth/login", {
    method: "POST",
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: "S".repeat(40),
      "Content-Type": "application/json",
      "X-RCAT-CMS-Client-IP": "192.0.2.1",
      "X-RCAT-CMS-User-Agent": "test"
    },
    body: JSON.stringify({ identifier: "admin", password: "password" })
  });
}

function successfulCredential(overrides = {}) {
  return {
    status: "success" as const,
    identity: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      isRoot: false,
      mustChangePassword: false,
      mfaRequired: false,
      sessionVersion: user.session_version,
      ...overrides
    }
  };
}

async function workingMfaRepository() {
  const encrypted = await encryptTotpSecret({
    secret: totpSecret,
    userId: user.id,
    encryptionKey,
    keyVersion: encryptionKeyVersion
  });
  const enabledFactor = {
    ...factor,
    encrypted_secret: encrypted.encryptedSecret,
    iv: encrypted.iv,
    key_version: encrypted.keyVersion,
    last_used_step: -1
  };
  let storedChallenge: AdminMfaChallengeRow | undefined;
  let recoveryCodeUsed = false;
  const recoveryCode = "AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-A";
  const repository = {
    getUserState: vi.fn(async () => ({ user, factor: enabledFactor, recoveryCodesRemaining: 1 })),
    createChallenge: vi.fn(async (challenge: AdminMfaChallengeRow) => {
      storedChallenge = challenge;
    }),
    findChallengeByTokenHash: vi.fn(async () =>
      storedChallenge ? { challenge: storedChallenge, user, factor: enabledFactor } : null
    ),
    recordChallengeFailure: vi.fn(async () => {
      if (storedChallenge) storedChallenge.failed_attempt_count += 1;
    }),
    findUnusedRecoveryCode: vi.fn(async () =>
      recoveryCodeUsed
        ? null
        : {
            id: "recovery-code-1",
            user_id: user.id,
            code_hash: "stored-recovery-hash",
            created_at: now.toISOString(),
            used_at: ""
          }
    ),
    completeLoginChallenge: vi.fn(
      async ({ challenge, proof, now: completedAt }: Parameters<AdminMfaRepository["completeLoginChallenge"]>[0]) => {
        if (challenge.consumed_at) throw new Error("challenge already consumed");
        challenge.consumed_at = completedAt;
        if (proof.type === "recovery") recoveryCodeUsed = true;
      }
    )
  } as unknown as AdminMfaRepository;
  return { repository, recoveryCode };
}

function mfaEnv() {
  return {
    CMS_AUTH_ENABLED: "true",
    CMS_AUTH_PROXY_SECRET: "S".repeat(40),
    CMS_MFA_ENCRYPTION_KEY: encryptionKey,
    CMS_MFA_ENCRYPTION_KEY_VERSION: encryptionKeyVersion
  };
}

function verificationRequest(challenge: string, body: Record<string, unknown>) {
  return new Request("https://worker.invalid/api/internal/cms-auth/mfa/verify", {
    method: "POST",
    headers: {
      [CMS_AUTH_PROXY_SECRET_HEADER]: "S".repeat(40),
      [CMS_MFA_CHALLENGE_TOKEN_HEADER]: challenge,
      "Content-Type": "application/json",
      "X-RCAT-CMS-Client-IP": "192.0.2.1",
      "X-RCAT-CMS-User-Agent": "test"
    },
    body: JSON.stringify(body)
  });
}

describe("CMS MFA login", () => {
  it("creates a password-only Session when the account has no effective MFA", async () => {
    const createSession = vi.fn(async () => ({
      identity: {
        ...successfulCredential().identity,
        sessionId: "new-session",
        reauthenticatedAt: now.toISOString(),
        mfaVerifiedAt: ""
      },
      sessionToken: "A".repeat(43),
      csrfToken: "B".repeat(43)
    }));
    const response = await handleCmsAuthInternal(
      loginRequest(),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: "S".repeat(40) },
      {
        now: () => now,
        mfaRepository: repository(false),
        verifyCredential: vi.fn(async () => successfulCredential()),
        createSession
      }
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get(CMS_NEW_SESSION_TOKEN_HEADER)).toBe("A".repeat(43));
    expect(response?.headers.get(CMS_NEW_CSRF_TOKEN_HEADER)).toBe("B".repeat(43));
    expect(response?.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER)).toBeNull();
    expect(createSession).toHaveBeenCalledOnce();
  });

  it("returns a login challenge without creating a session for an enabled factor", async () => {
    const mfaRepository = repository(true);
    const createSession = vi.fn();
    const response = await handleCmsAuthInternal(
      loginRequest(),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: "S".repeat(40) },
      {
        now: () => now,
        mfaRepository,
        verifyCredential: vi.fn(async () => successfulCredential()),
        createSession
      }
    );
    expect(response?.status).toBe(202);
    expect(await response?.json()).toEqual({ mfaRequired: true, enrollmentRequired: false });
    expect(response?.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mfaRepository.createChallenge).toHaveBeenCalledOnce();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates an enrollment Challenge for Root without a configured factor", async () => {
    const rootUser = { ...user, is_root: 1 as const };
    const mfaRepository = repository(false, rootUser);
    const createSession = vi.fn();
    const response = await handleCmsAuthInternal(
      loginRequest(),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: "S".repeat(40) },
      {
        now: () => now,
        mfaRepository,
        verifyCredential: vi.fn(async () => successfulCredential({ isRoot: true })),
        createSession
      }
    );

    expect(response?.status).toBe(202);
    expect(await response?.json()).toEqual({ mfaRequired: true, enrollmentRequired: true });
    expect(mfaRepository.createChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "enrollment", user_id: user.id }),
      user.email
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not query MFA state or reveal it when the password is wrong", async () => {
    const mfaRepository = repository(true);
    const createSession = vi.fn();
    const response = await handleCmsAuthInternal(
      loginRequest(),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: "S".repeat(40) },
      {
        now: () => now,
        mfaRepository,
        verifyCredential: vi.fn(async () => ({ status: "invalid" as const })),
        createSession
      }
    );

    expect(response?.status).toBe(401);
    expect(await response?.json()).toMatchObject({ error: "invalid identifier or password" });
    expect(mfaRepository.getUserState).not.toHaveBeenCalled();
    expect(mfaRepository.createChallenge).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("completes Login with a valid TOTP while invalid TOTP remains generic", async () => {
    const { repository: mfaRepository } = await workingMfaRepository();
    const login = await handleCmsAuthInternal(loginRequest(), mfaEnv(), {
      now: () => now,
      mfaRepository,
      verifyCredential: vi.fn(async () => successfulCredential())
    });
    const challenge = login?.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER) ?? "";

    expect(login?.status).toBe(202);
    expect(login?.headers.get(CMS_NEW_SESSION_TOKEN_HEADER)).toBeNull();
    expect(mfaRepository.completeLoginChallenge).not.toHaveBeenCalled();

    const invalid = await handleCmsAuthInternal(verificationRequest(challenge, { totpCode: "000000" }), mfaEnv(), {
      now: () => now,
      mfaRepository
    });
    expect(invalid?.status).toBe(401);
    expect(await invalid?.json()).toMatchObject({ error: "MFA verification failed" });

    const validCode = await generateTotpCode(totpSecret, now.getTime());
    const valid = await handleCmsAuthInternal(verificationRequest(challenge, { totpCode: validCode }), mfaEnv(), {
      now: () => now,
      mfaRepository
    });
    expect(valid?.status).toBe(200);
    expect(valid?.headers.get(CMS_NEW_SESSION_TOKEN_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(valid?.headers.get(CMS_NEW_CSRF_TOKEN_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mfaRepository.completeLoginChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ proof: expect.objectContaining({ type: "totp" }) })
    );
  });

  it("completes Login with one Recovery Code and rejects Challenge reuse", async () => {
    const { repository: mfaRepository, recoveryCode } = await workingMfaRepository();
    const login = await handleCmsAuthInternal(loginRequest(), mfaEnv(), {
      now: () => now,
      mfaRepository,
      verifyCredential: vi.fn(async () => successfulCredential())
    });
    const challenge = login?.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER) ?? "";
    const first = await handleCmsAuthInternal(verificationRequest(challenge, { recoveryCode }), mfaEnv(), {
      now: () => now,
      mfaRepository
    });
    const replay = await handleCmsAuthInternal(verificationRequest(challenge, { recoveryCode }), mfaEnv(), {
      now: () => now,
      mfaRepository
    });

    expect(first?.status).toBe(200);
    expect(mfaRepository.completeLoginChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ proof: expect.objectContaining({ type: "recovery" }) })
    );
    expect(replay?.status).toBe(401);
    expect(await replay?.json()).toMatchObject({ error: "MFA verification failed" });
    expect(mfaRepository.completeLoginChallenge).toHaveBeenCalledOnce();
  });
});
