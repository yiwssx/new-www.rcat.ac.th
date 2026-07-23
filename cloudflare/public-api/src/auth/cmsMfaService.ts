import type { CmsAuthenticatedIdentity } from "./cmsCredentialService";
import {
  CMS_MFA_CHALLENGE_MAX_FAILURES,
  generateMfaChallengeToken,
  getMfaChallengeExpiry,
  hashMfaChallengeMetadata,
  hashMfaChallengeToken
} from "./cmsMfaChallenge";
import { decryptTotpSecret, hashRecoveryCode } from "./cmsMfaCrypto";
import { fixedSizeBase64UrlEqual } from "./cmsSessionCrypto";
import { verifyTotpCode } from "./cmsTotp";
import {
  createAdminMfaRepository,
  isEffectiveMfa,
  type AdminMfaChallengeWithUser,
  type AdminMfaRepository,
  type MfaFactorProof
} from "../db/adminMfaRepository";
import type { AdminMfaChallengeRow, AdminMfaTotpRow } from "../db/schema";
import type { Env } from "../env";

export async function createCmsMfaChallenge(input: {
  env: Env;
  identity: CmsAuthenticatedIdentity;
  purpose: "login" | "enrollment";
  clientIp: string;
  userAgent: string;
  now: Date;
  repository?: AdminMfaRepository;
}) {
  const repository = input.repository ?? createAdminMfaRepository(input.env);
  const token = generateMfaChallengeToken();
  const proxySecret = input.env.CMS_AUTH_PROXY_SECRET ?? "";
  const [tokenHash, metadata] = await Promise.all([
    hashMfaChallengeToken(token),
    hashMfaChallengeMetadata(input.clientIp, input.userAgent, proxySecret)
  ]);
  const challenge: AdminMfaChallengeRow = {
    id: `admin-mfa-challenge-${crypto.randomUUID()}`,
    user_id: input.identity.id,
    token_hash: tokenHash,
    purpose: input.purpose,
    created_at: input.now.toISOString(),
    expires_at: getMfaChallengeExpiry(input.purpose, input.now).toISOString(),
    consumed_at: "",
    revoked_at: "",
    failed_attempt_count: 0,
    user_session_version: input.identity.sessionVersion,
    ip_hash: metadata.ipHash,
    user_agent_hash: metadata.userAgentHash
  };
  await repository.createChallenge(challenge, input.identity.email);
  return { challenge, token };
}

export async function validateCmsMfaChallenge(input: {
  env: Env;
  token: string;
  purpose?: "login" | "enrollment";
  clientIp: string;
  userAgent: string;
  now: Date;
  repository?: AdminMfaRepository;
  recordFailure?: boolean;
}) {
  const repository = input.repository ?? createAdminMfaRepository(input.env);
  const [tokenHash, metadata] = await Promise.all([
    hashMfaChallengeToken(input.token),
    hashMfaChallengeMetadata(input.clientIp, input.userAgent, input.env.CMS_AUTH_PROXY_SECRET ?? "")
  ]);
  const record = await repository.findChallengeByTokenHash(tokenHash);
  if (!record) return null;
  const { challenge, user } = record;
  const invalid =
    (input.purpose && challenge.purpose !== input.purpose) ||
    challenge.consumed_at !== "" ||
    challenge.revoked_at !== "" ||
    challenge.failed_attempt_count >= CMS_MFA_CHALLENGE_MAX_FAILURES ||
    challenge.user_session_version !== user.session_version ||
    user.status !== "active" ||
    input.now.getTime() >= Date.parse(challenge.expires_at) ||
    !fixedSizeBase64UrlEqual(challenge.ip_hash, metadata.ipHash) ||
    !fixedSizeBase64UrlEqual(challenge.user_agent_hash, metadata.userAgentHash);
  if (invalid) {
    if (input.recordFailure) {
      await repository.recordChallengeFailure(challenge.id, input.now.toISOString());
    }
    return null;
  }
  return record;
}

export async function resolveMfaFactorProof(input: {
  env: Env;
  record: AdminMfaChallengeWithUser | { factor: AdminMfaTotpRow | null; user: { id: string } };
  totpCode?: unknown;
  recoveryCode?: unknown;
  now: Date;
  repository?: AdminMfaRepository;
}): Promise<MfaFactorProof | null> {
  const hasTotp = input.totpCode !== undefined;
  const hasRecovery = input.recoveryCode !== undefined;
  if (hasTotp === hasRecovery || !input.record.factor || input.record.factor.state !== "enabled") return null;
  const repository = input.repository ?? createAdminMfaRepository(input.env);

  if (hasRecovery) {
    try {
      const codeHash = await hashRecoveryCode(input.recoveryCode);
      const code = await repository.findUnusedRecoveryCode(input.record.user.id, codeHash);
      return code ? { type: "recovery", codeHash, recoveryCodeId: code.id } : null;
    } catch {
      return null;
    }
  }

  const secret = await decryptTotpSecret({
    encryptedSecret: input.record.factor.encrypted_secret,
    iv: input.record.factor.iv,
    userId: input.record.user.id,
    storedKeyVersion: input.record.factor.key_version,
    encryptionKey: input.env.CMS_MFA_ENCRYPTION_KEY,
    configuredKeyVersion: input.env.CMS_MFA_ENCRYPTION_KEY_VERSION
  });
  const verified = await verifyTotpCode(input.totpCode, secret, input.now.getTime());
  return verified && verified.matchedStep > input.record.factor.last_used_step
    ? { type: "totp", matchedStep: verified.matchedStep }
    : null;
}

export function requiresCmsMfa(
  record: AdminMfaChallengeWithUser | { user: { is_root: 0 | 1; mfa_required: 0 | 1 }; factor: AdminMfaTotpRow | null }
) {
  return isEffectiveMfa(record.user, record.factor);
}
