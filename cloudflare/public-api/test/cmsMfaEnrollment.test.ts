// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateRecoveryCodes } from "../src/auth/cmsMfaCrypto";
import { getMfaChallengeExpiry } from "../src/auth/cmsMfaChallenge";
import { createTotpUri, generateTotpCode, generateTotpSecret } from "../src/auth/cmsTotp";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CSRF_TOKEN_HEADER,
  CMS_MFA_CHALLENGE_TOKEN_HEADER,
  CMS_NEW_CSRF_TOKEN_HEADER,
  CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER,
  CMS_NEW_SESSION_TOKEN_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  handleCmsAuthInternal
} from "../src/routes/cmsAuthInternal";
import type { AdminMfaRepository } from "../src/db/adminMfaRepository";
import type { AdminMfaChallengeRow, AdminMfaTotpRow } from "../src/db/schema";

const now = new Date("2026-07-23T03:00:00.000Z");
const proxySecret = "S".repeat(40);
const encryptionKey = "A".repeat(43);
const enrollmentEnv = {
  CMS_AUTH_ENABLED: "true",
  CMS_AUTH_PROXY_SECRET: proxySecret,
  CMS_MFA_ENCRYPTION_KEY: encryptionKey,
  CMS_MFA_ENCRYPTION_KEY_VERSION: "test-v1"
};
const FORBIDDEN_MFA_RESPONSE_KEY_PATTERN =
  /"(?:encrypted_secret|encryptedSecret|ciphertext|iv|session_id|sessionId|code_hash|codeHash)"\s*:/i;
const rootUser = {
  id: "root-user",
  email: "root@example.invalid",
  name: "Root",
  username: "root",
  role: "admin" as const,
  status: "active" as const,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  created_by: "fixture",
  updated_by: "fixture",
  revision: 1,
  is_root: 1 as const,
  must_change_password: 0 as const,
  mfa_required: 1 as const,
  session_version: 2,
  last_login_at: ""
};

function internalRequest(
  path: string,
  input: { body?: Record<string, unknown>; challenge?: string; session?: boolean } = {}
) {
  const headers = new Headers({
    [CMS_AUTH_PROXY_SECRET_HEADER]: proxySecret,
    "Content-Type": "application/json",
    "X-RCAT-CMS-Client-IP": "192.0.2.1",
    "X-RCAT-CMS-User-Agent": "test"
  });
  if (input.challenge) headers.set(CMS_MFA_CHALLENGE_TOKEN_HEADER, input.challenge);
  if (input.session) {
    headers.set(CMS_SESSION_TOKEN_HEADER, "A".repeat(43));
    headers.set(CMS_CSRF_TOKEN_HEADER, "B".repeat(43));
  }
  return new Request(`https://worker.invalid/api/internal/cms-auth/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body ?? {})
  });
}

describe("CMS MFA enrollment", () => {
  it("uses a strict ten-minute enrollment challenge and never puts the secret in the label", () => {
    const now = new Date("2026-07-23T03:00:00.000Z");
    expect(getMfaChallengeExpiry("enrollment", now).getTime() - now.getTime()).toBe(10 * 60 * 1000);
    const secret = generateTotpSecret();
    const uri = createTotpUri(secret, "root@example.invalid");
    expect(new URL(uri).searchParams.get("secret")).toBe(secret);
    expect(decodeURIComponent(new URL(uri).pathname)).toBe("/RCAT CMS:root@example.invalid");
  });

  it("returns ten distinct one-time recovery values for a completed enrollment", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("completes mandatory Root enrollment with one manual key, ten Recovery Codes, and a new Session", async () => {
    let challenge: AdminMfaChallengeRow | undefined;
    let pendingFactor: AdminMfaTotpRow | null = null;
    const confirmEnrollment = vi.fn(async (input: Parameters<AdminMfaRepository["confirmEnrollment"]>[0]) => {
      if (challenge) challenge.consumed_at = input.now;
    });
    const repository = {
      getUserState: vi.fn(async () => ({ user: rootUser, factor: pendingFactor, recoveryCodesRemaining: 0 })),
      createChallenge: vi.fn(async (created: AdminMfaChallengeRow) => {
        challenge = created;
      }),
      findChallengeByTokenHash: vi.fn(async () =>
        challenge ? { challenge, user: rootUser, factor: pendingFactor } : null
      ),
      recordChallengeFailure: vi.fn(async () => undefined),
      replacePendingFactor: vi.fn(async (factor: AdminMfaTotpRow) => {
        pendingFactor = factor;
      }),
      confirmEnrollment
    } as unknown as AdminMfaRepository;
    const login = await handleCmsAuthInternal(
      internalRequest("login", { body: { identifier: "root", password: "password" } }),
      enrollmentEnv,
      {
        now: () => now,
        mfaRepository: repository,
        verifyCredential: vi.fn(async () => ({
          status: "success" as const,
          identity: {
            id: rootUser.id,
            email: rootUser.email,
            name: rootUser.name,
            username: rootUser.username,
            role: rootUser.role,
            isRoot: true,
            mustChangePassword: false,
            mfaRequired: true,
            sessionVersion: rootUser.session_version
          }
        }))
      }
    );
    const challengeToken = login?.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER) ?? "";
    const setup = await handleCmsAuthInternal(
      internalRequest("mfa/setup/start", { challenge: challengeToken }),
      enrollmentEnv,
      { now: () => now, mfaRepository: repository }
    );
    const setupBody = (await setup?.json()) as { manualEntryKey: string };
    const totpCode = await generateTotpCode(setupBody.manualEntryKey, now.getTime());
    const confirmation = await handleCmsAuthInternal(
      internalRequest("mfa/setup/confirm", { body: { totpCode }, challenge: challengeToken }),
      enrollmentEnv,
      { now: () => now, mfaRepository: repository }
    );
    const confirmationBody = (await confirmation?.json()) as {
      recoveryCodes: string[];
      loginRequired: boolean;
    };

    expect(login?.status).toBe(202);
    expect(setup?.status).toBe(200);
    expect(Object.keys(setupBody).filter((key) => key === "manualEntryKey")).toHaveLength(1);
    expect(setupBody.manualEntryKey).toMatch(/^[A-Z2-7]{32}$/);
    expect(confirmation?.status).toBe(200);
    expect(confirmationBody.recoveryCodes).toHaveLength(10);
    expect(new Set(confirmationBody.recoveryCodes).size).toBe(10);
    expect(confirmationBody.loginRequired).toBe(false);
    expect(confirmation?.headers.get(CMS_NEW_SESSION_TOKEN_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(confirmation?.headers.get(CMS_NEW_CSRF_TOKEN_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(confirmEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        challengeId: challenge?.id,
        recoveryCodes: expect.arrayContaining([expect.objectContaining({ code_hash: expect.any(String) })]),
        session: expect.objectContaining({ user_id: rootUser.id })
      })
    );
    expect(JSON.stringify(setupBody)).not.toMatch(FORBIDDEN_MFA_RESPONSE_KEY_PATTERN);
    expect(JSON.stringify(confirmationBody)).not.toMatch(FORBIDDEN_MFA_RESPONSE_KEY_PATTERN);
  });

  it("marks voluntary setup login-required and delegates revocation without creating a replacement Session", async () => {
    const voluntaryUser = {
      ...rootUser,
      id: "voluntary-user",
      email: "voluntary@example.invalid",
      is_root: 0 as const,
      mfa_required: 0 as const
    };
    let pendingFactor: AdminMfaTotpRow | null = null;
    const confirmEnrollment = vi.fn(async () => undefined);
    const repository = {
      getUserState: vi.fn(async () => ({ user: voluntaryUser, factor: pendingFactor, recoveryCodesRemaining: 0 })),
      replacePendingFactor: vi.fn(async (factor: AdminMfaTotpRow) => {
        pendingFactor = factor;
      }),
      confirmEnrollment
    } as unknown as AdminMfaRepository;
    const authenticateSession = vi.fn(async () => ({
      status: "authenticated" as const,
      identity: {
        id: voluntaryUser.id,
        email: voluntaryUser.email,
        name: voluntaryUser.name,
        username: voluntaryUser.username,
        role: voluntaryUser.role,
        isRoot: false,
        sessionId: "old-session",
        sessionVersion: voluntaryUser.session_version,
        reauthenticatedAt: now.toISOString(),
        mfaVerifiedAt: ""
      }
    }));
    const setup = await handleCmsAuthInternal(internalRequest("mfa/setup/start", { session: true }), enrollmentEnv, {
      now: () => now,
      authenticateSession,
      mfaRepository: repository
    });
    const setupBody = (await setup?.json()) as { manualEntryKey: string };
    const confirmation = await handleCmsAuthInternal(
      internalRequest("mfa/setup/confirm", {
        body: { totpCode: await generateTotpCode(setupBody.manualEntryKey, now.getTime()) },
        session: true
      }),
      enrollmentEnv,
      { now: () => now, authenticateSession, mfaRepository: repository }
    );
    const confirmationBody = await confirmation?.json();

    expect(confirmation?.status).toBe(200);
    expect(confirmationBody).toMatchObject({ loginRequired: true, recoveryCodes: expect.any(Array) });
    expect(confirmation?.headers.get(CMS_NEW_SESSION_TOKEN_HEADER)).toBeNull();
    expect(confirmEnrollment).toHaveBeenCalledWith(expect.objectContaining({ session: undefined }));
  });
});
