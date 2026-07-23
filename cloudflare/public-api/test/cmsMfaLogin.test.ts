// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER,
  handleCmsAuthInternal
} from "../src/routes/cmsAuthInternal";
import type { AdminMfaRepository } from "../src/db/adminMfaRepository";

const now = new Date("2026-07-23T03:00:00.000Z");
const user = {
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

function repository(configured: boolean) {
  return {
    getUserState: vi.fn(async () => ({
      user,
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

describe("CMS MFA login", () => {
  it("returns a login challenge without creating a session for an enabled factor", async () => {
    const mfaRepository = repository(true);
    const response = await handleCmsAuthInternal(
      loginRequest(),
      { CMS_AUTH_ENABLED: "true", CMS_AUTH_PROXY_SECRET: "S".repeat(40) },
      {
        now: () => now,
        mfaRepository,
        verifyCredential: vi.fn(async () => ({
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
            sessionVersion: user.session_version
          }
        })),
        createSession: vi.fn()
      }
    );
    expect(response?.status).toBe(202);
    expect(await response?.json()).toEqual({ mfaRequired: true, enrollmentRequired: false });
    expect(response?.headers.get(CMS_NEW_MFA_CHALLENGE_TOKEN_HEADER)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mfaRepository.createChallenge).toHaveBeenCalledOnce();
  });
});
