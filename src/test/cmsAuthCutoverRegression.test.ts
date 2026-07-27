// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcRoot = join(repositoryRoot, "src");
const productionRoots = [
  join(repositoryRoot, "api"),
  join(repositoryRoot, "server"),
  join(repositoryRoot, "cloudflare", "public-api", "src"),
  join(repositoryRoot, "cloudflare", "public-api", "scripts"),
  srcRoot
];
const productionExtensions = /\.(?:js|mjs|ts|tsx)$/;
const forbiddenRuntimeReferences = [
  "ADMIN_PROXY_PASSWORD_HASH",
  "ADMIN_PROXY_SESSION_SECRET",
  "ADMIN_PROXY_ALLOWED_EMAILS",
  "ADMIN_RBAC_ADMINS",
  "ADMIN_RBAC_EDITORS",
  "ADMIN_RBAC_VIEWERS",
  "CLOUDFLARE_ADMIN_SMOKE_TOKEN",
  "CMS_AUTH_ENABLED",
  "X-RCAT-Admin-Smoke-Token",
  "X-RCAT-Admin-Proxy-Email",
  "X-RCAT-Admin-Proxy-Role",
  "admin-proxy.local",
  "loginAdminProxySession",
  "loginCloudflareAdminProxySession",
  "createAdminProxyMarkerToken",
  "restoreSession"
] as const;

function productionSources(path: string): string[] {
  if (statSync(path).isFile()) {
    return productionExtensions.test(path) && !/\.test\.(?:js|mjs|ts|tsx)$/.test(path) ? [path] : [];
  }

  return readdirSync(path).flatMap((entry) => productionSources(join(path, entry)));
}

function readProductionGraph() {
  return productionRoots
    .flatMap(productionSources)
    .map((path) => `${path}\n${readFileSync(path, "utf8")}`)
    .join("\n");
}

describe("CMS authentication final-cutover regression guard", () => {
  it("keeps all production code free of retired authentication runtime references", () => {
    const source = readProductionGraph();

    for (const forbidden of forbiddenRuntimeReferences) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });

  it("keeps the browser authentication graph cookie-only and CMS-only", () => {
    const source = productionSources(srcRoot)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const authContext = readFileSync(join(srcRoot, "context", "AuthContext.tsx"), "utf8");

    expect(source).not.toMatch(/session\.token|projectSettings\.storageKeys\.session/);
    expect(authContext).not.toMatch(/localStorage|sessionStorage/);
    expect(source).toContain("/api/cms-auth/");
    expect(source).toContain("/api/admin-proxy");
    expect(source).toContain("/api/apps-script-proxy");
  });

  it("keeps the Integrations status flow on CMS cookies and server capabilities", () => {
    const integrationsPage = readFileSync(join(srcRoot, "admin", "pages", "IntegrationsPage.tsx"), "utf8");
    const adminWriteProvider = readFileSync(join(srcRoot, "config", "adminWriteProvider.ts"), "utf8");
    const mediaBridgeClient = readFileSync(join(srcRoot, "features", "cms-media", "mediaBridgeClient.ts"), "utf8");

    expect(integrationsPage).toContain('status === "authenticated"');
    expect(integrationsPage).toContain('hasCmsCapability(capabilities, "media.read")');
    expect(integrationsPage).toContain('<StatusChip status="connected" />');
    expect(integrationsPage).not.toContain("getAdminWriteProvider");
    expect(adminWriteProvider).toContain('const serverProxyPath = "/api/admin-proxy"');
    expect(adminWriteProvider).toContain('return "cloudflare"');
    expect(adminWriteProvider).not.toMatch(/apps-script|VITE_ADMIN_WRITE_PROVIDER|VITE_BACKEND_MIGRATION_MODE/);
    expect(adminWriteProvider).not.toContain("VITE_CLOUDFLARE_ADMIN_PROXY_URL");
    expect(mediaBridgeClient).toContain('credentials: "include"');
  });

  it("mounts exactly one reauthentication dialog inside the CMS Auth route boundary", () => {
    const app = readFileSync(join(srcRoot, "App.tsx"), "utf8");
    const authRouteComponents = readFileSync(join(srcRoot, "cmsAuthRouteComponents.tsx"), "utf8");
    const shell = readFileSync(join(srcRoot, "admin", "layout", "CmsShell.tsx"), "utf8");
    const combined = `${app}\n${authRouteComponents}\n${shell}`;

    expect(combined.match(/<ReauthenticationDialog\s*\/>/g)).toHaveLength(1);
    expect(app).not.toContain("ReauthenticationDialog");
    expect(authRouteComponents).toContain("<ReauthenticationDialog />");
    expect(shell).not.toContain("ReauthenticationDialog");
    expect(authRouteComponents.indexOf("<AuthProvider>")).toBeLessThan(
      authRouteComponents.indexOf("<ReauthenticationDialog />")
    );
    expect(app).toContain("<ThemeProvider");
    expect(app).not.toContain("AuthProvider");
  });

  it("keeps raw Recovery Codes in the application-level React handoff only", () => {
    const handoffContext = readFileSync(join(srcRoot, "context", "RecoveryCodeHandoffContext.tsx"), "utf8");
    const handoffProvider = readFileSync(join(srcRoot, "context", "RecoveryCodeHandoffProvider.tsx"), "utf8");
    const handoffDialog = readFileSync(join(srcRoot, "admin", "components", "RecoveryCodeHandoffDialog.tsx"), "utf8");
    const navigationGuard = readFileSync(
      join(srcRoot, "admin", "components", "RecoveryCodeNavigationGuard.tsx"),
      "utf8"
    );
    const source = `${handoffContext}\n${handoffProvider}\n${handoffDialog}\n${navigationGuard}`;

    expect(source).not.toMatch(/localStorage|sessionStorage|pushState|replaceState|URLSearchParams/);
    expect(source).toContain('window.addEventListener("beforeunload"');
    expect(navigationGuard).toContain("useBlocker");
    expect(navigationGuard).toContain("shouldBlockNavigation");
  });
});
