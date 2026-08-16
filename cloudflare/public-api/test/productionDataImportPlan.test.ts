import { describe, expect, it } from "vitest";
import m9ImportPlanDoc from "../../../docs/architecture/m9-public-document-list-production-data-import-plan-2026-06-11.md?raw";
import publicApiProviderSource from "../../../src/config/publicApiProvider.ts?raw";
import wranglerToml from "../wrangler.toml?raw";

const committedD1DatabaseIdPattern = /^\s*database_id\s*=\s*"[0-9a-f-]{32,}"\s*$/im;
const forbiddenUrlPattern = /https?:\/\/[^\s)"']*(?:script\.google\.com|drive\.google\.com)/i;

const publicContractFields = [
  "id",
  "title",
  "description",
  "category",
  "fileUrl",
  "fileName",
  "mediaId",
  "publishedAt",
  "order",
  "pinned",
  "updatedAt"
];

const d1Columns = [
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "sort_order",
  "pinned",
  "updated_at",
  "status"
];

describe("M9 public document production data import planning safety", () => {
  it("documents planning-only import scope without executing production work", () => {
    expect(m9ImportPlanDoc).toMatch(
      /Status: production data import planning only\. No production import, migration, deployment, or cutover is executed\./i
    );
    expect(m9ImportPlanDoc).toMatch(/public-document-list/i);
    expect(m9ImportPlanDoc).toMatch(/Source of Truth/i);
    expect(m9ImportPlanDoc).toMatch(/Data Mapping/i);
    expect(m9ImportPlanDoc).toMatch(/Import Strategy Draft/i);
    expect(m9ImportPlanDoc).toMatch(/Draft only\. Do not execute in M9\./i);
    expect(m9ImportPlanDoc).toMatch(/Validation Rules/i);
    expect(m9ImportPlanDoc).toMatch(/Parity Evidence Template/i);
    expect(m9ImportPlanDoc).toMatch(/Rollback Data Strategy/i);
    expect(m9ImportPlanDoc).toMatch(/No-Go Conditions/i);
    expect(m9ImportPlanDoc).toMatch(/Production Safety Confirmation/i);
    expect(m9ImportPlanDoc).toMatch(/PublicDocumentListSnapshot/i);
    expect(m9ImportPlanDoc).not.toMatch(
      /production (?:import|cutover)\s*(?:completed|passed|approved|enabled|active)/i
    );
  });

  it("captures the public contract fields, D1 columns, mapping, and ordering expectations", () => {
    publicContractFields.forEach((field) => {
      expect(m9ImportPlanDoc).toContain(`\`${field}\``);
    });
    d1Columns.forEach((column) => {
      expect(m9ImportPlanDoc).toContain(`\`${column}\``);
    });

    expect(m9ImportPlanDoc).toMatch(/D1 snake_case maps to public camelCase/i);
    expect(m9ImportPlanDoc).toMatch(/`sort_order` maps to public `order`/i);
    expect(m9ImportPlanDoc).toMatch(/only published\/active records should be served/i);
    expect(m9ImportPlanDoc).toMatch(/internal fields such as `status` must not leak/i);
    expect(m9ImportPlanDoc).toMatch(/pinned first/i);
    expect(m9ImportPlanDoc).toMatch(/`sort_order` ascending/i);
    expect(m9ImportPlanDoc).toMatch(/`published_at` descending/i);
    expect(m9ImportPlanDoc).toMatch(/`updated_at` descending/i);
  });

  it("keeps committed production identifiers and forbidden URLs out of the M9 plan", () => {
    expect(m9ImportPlanDoc).not.toMatch(committedD1DatabaseIdPattern);
    expect(m9ImportPlanDoc).not.toMatch(forbiddenUrlPattern);
    expect(wranglerToml).toMatch(/database_id\s*=\s*"local-placeholder"/);
    expect(wranglerToml).toMatch(/database_id\s*=\s*"production-placeholder"/);
    expect(wranglerToml).not.toMatch(committedD1DatabaseIdPattern);
  });

  it("keeps the current frontend public API contract Cloudflare-only", () => {
    expect(publicApiProviderSource).toMatch(/VITE_CLOUDFLARE_PUBLIC_API_URL/);
    expect(publicApiProviderSource).toMatch(/CLOUDFLARE_PUBLIC_API_URL/);
    expect(publicApiProviderSource).not.toMatch(/VITE_PUBLIC_API_PROVIDER/);
    expect(publicApiProviderSource).not.toMatch(/apps-script/);
    expect(publicApiProviderSource).not.toMatch(/production-cloudflare/);
  });
});
