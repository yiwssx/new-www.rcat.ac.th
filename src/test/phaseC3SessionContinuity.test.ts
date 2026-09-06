// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const authContext = readFileSync(join(repositoryRoot, "src", "context", "AuthContext.tsx"), "utf8");

describe("Phase C3 CMS session continuity", () => {
  it("bounds retry to explicit authorization confirmation while normal Session refreshes remain fail-closed", () => {
    expect(authContext).toContain("retryCmsAuthorizationRead");
    expect(authContext).toContain("error instanceof CmsAuthError && error.status === 401");
    expect(authContext).toContain("retryAuthorization401?: boolean");
    expect(authContext).toContain("refreshSession({ force: true, retryAuthorization401: true })");
    expect(authContext).toContain("refreshSession({ retryAuthorization401: true })");
    expect(authContext).toContain("const [sessionResult, capabilityResult] = await Promise.allSettled");
    expect(authContext).toContain("void refreshSession().catch(() => undefined)");
    expect(authContext).toContain("void refreshSession({ activityKeepalive: true }).catch(() => undefined)");
    expect(authContext).toContain("Persistent 401 responses still fail closed and mutations are never retried.");
  });

  it("does not report password Login success unless the refreshed authorization state is authenticated", () => {
    expect(authContext).toContain("const nextSession = await refreshSession({ force: true, retryAuthorization401: true })");
    expect(authContext).toMatch(/if \(!nextSession\) \{\s*throw new CmsAuthError\(401\);\s*\}/);
    expect(authContext).toContain('broadcastCmsSessionEvent("session-changed")');
  });
});
