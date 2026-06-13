import { describe, expect, it } from "vitest";
import m16Doc from "../../docs/architecture/m16-cloudflare-first-backend-reset-2026-06-13.md?raw";
import {
  getBackendEndpointMigrationPolicy,
  resolveBackendProviderPolicy,
  validateM16CloudflarePreviewOrigin
} from "./backendProviderPolicy";

describe("M16 backend provider policy", () => {
  const googleFileStorageHost = ["drive", "google", "com"].join(".");

  it("allows dev or preview Cloudflare origins only in cloudflare-first preview mode", () => {
    const policy = resolveBackendProviderPolicy({
      VITE_BACKEND_MIGRATION_MODE: "cloudflare-first-preview",
      VITE_PUBLIC_API_PROVIDER: "cloudflare",
      VITE_CLOUDFLARE_PUBLIC_API_URL: "https://rcat-public-api-preview.example.test"
    });

    expect(policy.mode).toBe("cloudflare-first-preview");
    expect(policy.cloudflarePreviewEndpointAllowed).toBe(true);
    expect(policy.productionDomainCutoverAllowed).toBe(false);
    expect(policy.m15ProductionValidationRemainsStrict).toBe(true);
    expect(policy.validationIssues).toEqual([]);
  });

  it("does not treat dev or preview origins as production cutover targets", () => {
    expect(validateM16CloudflarePreviewOrigin("https://rcat-public-api-preview.example.test")).toEqual({
      allowed: true,
      isProductionCutoverTarget: false,
      reason: "dev-preview-origin"
    });
  });

  it("blocks production-looking or forbidden origins during M16 preview migration", () => {
    expect(validateM16CloudflarePreviewOrigin("https://rcat-public-api.example.com")).toMatchObject({
      allowed: false,
      isProductionCutoverTarget: false,
      reason: "not-dev-preview-origin"
    });

    expect(validateM16CloudflarePreviewOrigin(`https://${googleFileStorageHost}/file/example`)).toMatchObject({
      allowed: false,
      isProductionCutoverTarget: false,
      reason: "forbidden-origin"
    });
  });

  it("keeps Apps Script fallback available for endpoints not migrated yet", () => {
    expect(getBackendEndpointMigrationPolicy("public-document-list")).toMatchObject({
      currentProvider: "cloudflare-preview-capable",
      targetProvider: "cloudflare-worker-d1",
      appsScriptFallback: true
    });

    expect(getBackendEndpointMigrationPolicy("public-home")).toMatchObject({
      currentProvider: "apps-script",
      targetProvider: "cloudflare-worker-d1",
      appsScriptFallback: true
    });

    expect(getBackendEndpointMigrationPolicy("media-file-upload-delete")).toMatchObject({
      currentProvider: "apps-script",
      targetProvider: "apps-script-media-bridge",
      appsScriptFallback: true
    });
  });

  it("documents M16 without committing production endpoint evidence", () => {
    expect(m16Doc).toMatch(/Cloudflare-first backend/i);
    expect(m16Doc).toMatch(/M15\.2 real execute cutover is deferred/i);
    expect(m16Doc).toMatch(/media-file bridge only/i);
    expect(m16Doc).toMatch(/dev\/preview Worker origins only/i);
    expect(m16Doc).not.toMatch(/script\.google\.com|drive\.google\.com|rcat\.ac\.th/i);
    expect(m16Doc).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  });
});
