import { describe, expect, it } from "vitest";
import m61ProvisioningDoc from "../../../docs/architecture/m6-1-preview-resource-provisioning-2026-05-27.md?raw";
import m63PreflightDoc from "../../../docs/architecture/m6-3-preview-smoke-preflight-2026-05-27.md?raw";
import m6PreviewSmokeDoc from "../../../docs/architecture/m6-preview-worker-d1-smoke-2026-05-27.md?raw";
import previewSeedSql from "../seed/public-documents.preview.seed.sql?raw";
import wranglerToml from "../wrangler.toml?raw";
import { DOCUMENT_ROW_COLUMNS } from "../src/db/schema";
import worker from "../src/index";

const forbiddenProductionPatterns = /rcat\.ac\.th|script\.google\.com|drive\.google\.com|workers\.dev/i;
const forbiddenProductionUrlPatterns =
  /https?:\/\/[^\s)"']*(?:rcat\.ac\.th|script\.google\.com|drive\.google\.com|workers\.dev)/i;
const committedD1DatabaseIdPattern = /^\s*database_id\s*=\s*"[0-9a-f-]{32,}"\s*$/im;

function getPreviewConfigBlock(toml: string) {
  const match = /\[env\.preview\][\s\S]*?(?=\n\[env\.|\n\[\[d1_databases\]\]|$)/.exec(toml);

  expect(match, "wrangler.toml should define an env.preview block").not.toBeNull();

  return match?.[0] ?? "";
}

function getInsertColumns(sql: string) {
  const match = /INSERT\s+INTO\s+documents\s*\(([^)]*)\)/i.exec(sql);

  expect(match, "preview seed SQL should insert into documents with an explicit column list").not.toBeNull();

  return match?.[1].split(",").map((column) => column.trim().replaceAll('"', ""));
}

function getM64AttemptBlock(markdown: string) {
  const match = /## M6\.4 Attempt[\s\S]*?(?=\n## |$)/.exec(markdown);

  expect(match, "M6 preview smoke doc should include an M6.4 attempt block").not.toBeNull();

  return match?.[0] ?? "";
}

function getPreviewResourceStatus(markdown: string) {
  const match = /^Preview Resource Status:\s*(.+)$/im.exec(markdown);

  expect(match, "M6 preview smoke doc should declare a preview resource status").not.toBeNull();

  return match?.[1].trim() ?? "";
}

function m64DetailsAreBlocked(block: string) {
  return (
    /### Preflight Result[\s\S]*?\bBLOCKED\b/i.test(block) &&
    /### Remote Preview Commands[\s\S]*?\bNot run\b/i.test(block) &&
    /### Migration Result[\s\S]*?\bNot run\b/i.test(block) &&
    /### Preview Seed Result[\s\S]*?\bNot run\b/i.test(block) &&
    /### Preview Worker Deploy Result[\s\S]*?\bNot run\b/i.test(block) &&
    /### Vercel Preview Env Result[\s\S]*?\bNot set\b/i.test(block) &&
    /### Browser And Network Smoke Result[\s\S]*?\bNot run\b/i.test(block) &&
    /### Rollback Result[\s\S]*?\bNot needed\b/i.test(block)
  );
}

function m64DetailsAreCompleted(block: string) {
  return (
    /### Preflight Result[\s\S]*?\bREADY\b/i.test(block) &&
    /### Remote Preview Commands[\s\S]*?\bRun against confirmed non-production preview only\b/i.test(block) &&
    /### Migration Result[\s\S]*?\bPassed\b/i.test(block) &&
    /### Preview Seed Result[\s\S]*?\bPassed\b/i.test(block) &&
    /### Preview Worker Deploy Result[\s\S]*?\bPassed\b/i.test(block) &&
    /### Vercel Preview Env Result[\s\S]*?\bPassed\b/i.test(block) &&
    /### Browser And Network Smoke Result[\s\S]*?\bPassed\b/i.test(block) &&
    /### Rollback Result[\s\S]*?\bPassed\b/i.test(block) &&
    /### (?:Production|Committed Repository) Safety Confirmation[\s\S]*?\bPassed\b/i.test(block)
  );
}

describe("M5 non-production D1 preview safety", () => {
  it("documents a preview-only D1 binding with a non-production placeholder id", () => {
    const previewBlock = getPreviewConfigBlock(wranglerToml);

    expect(previewBlock).toMatch(/^\[env\.preview\]\s*$/m);
    expect(previewBlock).toMatch(/^\[\[env\.preview\.d1_databases\]\]\s*$/m);
    expect(previewBlock).toMatch(/^\s*binding\s*=\s*"DB"\s*$/m);
    expect(previewBlock).toMatch(/^\s*database_name\s*=\s*"rcat-public-api-preview"\s*$/m);
    expect(previewBlock).toMatch(/^\s*database_id\s*=\s*"preview-placeholder"\s*$/m);
    expect(wranglerToml).toMatch(/preview-only/i);
    expect(previewBlock).not.toMatch(/^\s*database_id\s*=\s*"[0-9a-f-]{32,}"\s*$/im);
  });

  it("keeps the preview seed fake, repeatable, and limited to documents", () => {
    expect(previewSeedSql).toMatch(/DELETE\s+FROM\s+documents\s+WHERE\s+id\s+LIKE\s+'preview-%';/i);
    expect(previewSeedSql).toMatch(/INSERT\s+INTO\s+documents\s*\(/i);
    expect(previewSeedSql).not.toMatch(/\bINSERT\s+INTO\s+(?!documents\b)[a-z_]+/i);
    expect(previewSeedSql).not.toMatch(/\bDELETE\s+FROM\s+(?!documents\b)[a-z_]+/i);

    const insertedIds = Array.from(previewSeedSql.matchAll(/'(preview-[^']*)'/g))
      .map((match) => match[1])
      .filter((value) => value.includes("document"));

    expect(insertedIds.length).toBeGreaterThan(0);
    insertedIds.forEach((id) => {
      expect(id).toMatch(/^preview-/);
    });
  });

  it("keeps preview seed columns aligned with the public document D1 row contract", () => {
    expect(getInsertColumns(previewSeedSql)).toEqual(DOCUMENT_ROW_COLUMNS);
  });

  it("keeps preview seed URLs sanitized and fake-only", () => {
    const urls = Array.from(previewSeedSql.matchAll(/https?:\/\/[^'\s)]+/g)).map((match) => match[0]);

    expect(previewSeedSql).not.toMatch(forbiddenProductionPatterns);
    expect(previewSeedSql).not.toMatch(/\b(users|user_accounts|auth|sessions|admin|media_uploads)\b/i);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => {
      expect(new URL(url).hostname).toMatch(/(^|\.)example\.test$/);
    });
  });

  it("keeps Worker route behavior on the PublicDocumentListSnapshot contract", async () => {
    const response = await worker.fetch(new Request("https://preview-public-api.example.test/api/public/documents"), {
      DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async all() {
              return {
                success: true,
                results: [
                  {
                    id: "preview-public-document-001",
                    title: "Preview handbook",
                    description: "Fake preview row for M5.",
                    category: "preview",
                    file_url: "https://files.example.test/preview/handbook.pdf",
                    file_name: "handbook.pdf",
                    media_id: "preview-media-001",
                    published_at: "2026-05-27T00:00:00.000Z",
                    status: "published",
                    sort_order: 10,
                    pinned: 1,
                    updated_at: "2026-05-27T00:00:00.000Z"
                  }
                ]
              };
            }
          };
        }
      } as unknown as D1Database
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(Object.keys(payload).sort()).toEqual(["generatedAt", "items"]);
    expect(payload.items).toEqual([
      {
        id: "preview-public-document-001",
        title: "Preview handbook",
        description: "Fake preview row for M5.",
        category: "preview",
        fileUrl: "https://files.example.test/preview/handbook.pdf",
        fileName: "handbook.pdf",
        mediaId: "preview-media-001",
        publishedAt: "2026-05-27T00:00:00.000Z",
        order: 10,
        pinned: true,
        updatedAt: "2026-05-27T00:00:00.000Z"
      }
    ]);
  });
});

describe("M6 preview smoke safety", () => {
  it("records preview smoke status without committing production identifiers or URLs", () => {
    const previewResourceStatus = getPreviewResourceStatus(m6PreviewSmokeDoc);
    const m64AttemptBlock = getM64AttemptBlock(m6PreviewSmokeDoc);
    const m64Blocked = m64DetailsAreBlocked(m64AttemptBlock);
    const m64Completed = m64DetailsAreCompleted(m64AttemptBlock);

    expect(previewResourceStatus).not.toBe("Ready");
    expect(previewResourceStatus).toMatch(/^(Blocked|Completed)$/);
    expect(m64Blocked || m64Completed).toBe(true);

    if (m64Blocked) {
      expect(previewResourceStatus).toBe("Blocked");
      expect(m6PreviewSmokeDoc).toMatch(/Status: actual non-production preview smoke remains blocked\./i);
    }

    if (m64Completed) {
      expect(previewResourceStatus).toBe("Completed");
      expect(m6PreviewSmokeDoc).toMatch(
        /Status: actual non-production preview smoke completed successfully using external non-committed preview resources\./i
      );
      expect(m6PreviewSmokeDoc).toMatch(/Committed Repository State:\s*Safe placeholder state/i);
    }

    expect(m6PreviewSmokeDoc).toMatch(/M6\.2 Attempt/i);
    expect(m6PreviewSmokeDoc).toMatch(/M6\.4 Attempt/i);
    expect(m6PreviewSmokeDoc).toMatch(/Preflight Result/i);
    expect(m6PreviewSmokeDoc).toContain("RCAT_PREVIEW_D1_DATABASE_NAME");
    expect(m6PreviewSmokeDoc).toContain("RCAT_PREVIEW_D1_DATABASE_ID");
    expect(m6PreviewSmokeDoc).toContain("RCAT_PREVIEW_WORKER_URL");
    expect(m6PreviewSmokeDoc).toContain("RCAT_VERCEL_PREVIEW_URL");
    expect(m6PreviewSmokeDoc).toMatch(/Required External Input Check/i);
    expect(m6PreviewSmokeDoc).toMatch(/Remote Preview Commands/i);
    expect(m6PreviewSmokeDoc).toMatch(/Migration Result/i);
    expect(m6PreviewSmokeDoc).toMatch(/Preview Seed Result/i);
    expect(m6PreviewSmokeDoc).toMatch(/Preview Worker URL/i);
    expect(m6PreviewSmokeDoc).toMatch(/Vercel Preview Env/i);
    expect(m6PreviewSmokeDoc).toMatch(/Browser And Network Smoke Result/i);
    expect(m6PreviewSmokeDoc).toMatch(/Rollback/i);
    expect(m6PreviewSmokeDoc).toMatch(/no production cutover/i);
    expect(m6PreviewSmokeDoc).not.toMatch(/production cutover\s*(?:completed|passed|enabled|active)/i);
    expect(m6PreviewSmokeDoc).not.toMatch(committedD1DatabaseIdPattern);
    expect(m6PreviewSmokeDoc).not.toMatch(forbiddenProductionUrlPatterns);
    expect(wranglerToml).not.toMatch(committedD1DatabaseIdPattern);
  });

  it("allows completed external smoke while the committed preview D1 id remains a placeholder", () => {
    const previewResourceStatus = getPreviewResourceStatus(m6PreviewSmokeDoc);
    const previewBlock = getPreviewConfigBlock(wranglerToml);
    const m64AttemptBlock = getM64AttemptBlock(m6PreviewSmokeDoc);

    expect(previewResourceStatus).toBe("Completed");
    expect(m64DetailsAreCompleted(m64AttemptBlock)).toBe(true);
    expect(m6PreviewSmokeDoc).toMatch(/external non-committed preview resources/i);
    expect(m6PreviewSmokeDoc).toMatch(/real preview D1 id was used only outside git/i);
    expect(m6PreviewSmokeDoc).toMatch(/intentionally reverted to `preview-placeholder` before commit/i);
    expect(previewBlock).toMatch(/^\s*database_id\s*=\s*"preview-placeholder"\s*$/m);
    expect(wranglerToml).not.toMatch(committedD1DatabaseIdPattern);
  });

  it("keeps the preview seed documents-only for M6 smoke data", () => {
    expect(previewSeedSql).toMatch(/\bINSERT\s+INTO\s+documents\b/i);
    expect(previewSeedSql).not.toMatch(/\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE)\s+(?!documents\b)[a-z_]+/i);
    expect(previewSeedSql).not.toMatch(forbiddenProductionUrlPatterns);
  });
});

describe("M6.1 preview resource provisioning safety", () => {
  it("documents the external preview resource checklist with placeholders only", () => {
    expect(m61ProvisioningDoc).toMatch(/Cloudflare Account And Project Confirmation/i);
    expect(m61ProvisioningDoc).toMatch(/Non-Production D1 Database Name/i);
    expect(m61ProvisioningDoc).toMatch(/Non-Production D1 Database Id Handling/i);
    expect(m61ProvisioningDoc).toMatch(/HTTPS Preview Worker URL/i);
    expect(m61ProvisioningDoc).toMatch(/Vercel Preview Frontend URL/i);
    expect(m61ProvisioningDoc).toMatch(/Vercel Preview Env Vars/i);
    expect(m61ProvisioningDoc).toMatch(/Rollback/i);
    expect(m61ProvisioningDoc).toContain("<preview-d1-database-id>");
    expect(m61ProvisioningDoc).toContain("<preview-worker-https-url>");
    expect(m61ProvisioningDoc).toContain("<vercel-preview-url>");
    expect(m61ProvisioningDoc).toContain("VITE_PUBLIC_API_PROVIDER=cloudflare");
    expect(m61ProvisioningDoc).toContain("VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>");
    expect(m61ProvisioningDoc).toMatch(/M6 remains blocked/i);
    expect(m61ProvisioningDoc).toMatch(/public-document-list/i);
    expect(m61ProvisioningDoc).toMatch(/no production cutover/i);
    expect(m61ProvisioningDoc).not.toMatch(committedD1DatabaseIdPattern);
    expect(m61ProvisioningDoc).not.toMatch(forbiddenProductionPatterns);
  });

  it("keeps the committed preview binding and seed in placeholder-only preview mode", () => {
    expect(getPreviewConfigBlock(wranglerToml)).toMatch(/^\s*database_id\s*=\s*"preview-placeholder"\s*$/m);
    expect(previewSeedSql).toMatch(/\bINSERT\s+INTO\s+documents\b/i);
    expect(previewSeedSql).not.toMatch(/\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE)\s+(?!documents\b)[a-z_]+/i);
    expect(previewSeedSql).not.toMatch(forbiddenProductionPatterns);
  });
});

describe("M6.3 preview smoke preflight safety", () => {
  it("documents the local preflight gate without committing production values", () => {
    expect(m63PreflightDoc).toMatch(/Purpose/i);
    expect(m63PreflightDoc).toMatch(/Required Env Vars/i);
    expect(m63PreflightDoc).toMatch(/Safe Example/i);
    expect(m63PreflightDoc).toMatch(/READY And BLOCKED/i);
    expect(m63PreflightDoc).toMatch(/M6\.4 actual non-production preview smoke/i);
    expect(m63PreflightDoc).toMatch(/No Worker deploy or remote D1 command is run by the preflight/i);
    expect(m63PreflightDoc).toContain("RCAT_PREVIEW_D1_DATABASE_NAME");
    expect(m63PreflightDoc).toContain("RCAT_PREVIEW_D1_DATABASE_ID");
    expect(m63PreflightDoc).toContain("RCAT_PREVIEW_WORKER_URL");
    expect(m63PreflightDoc).toContain("RCAT_VERCEL_PREVIEW_URL");
    expect(m63PreflightDoc).toContain("VITE_PUBLIC_API_PROVIDER=cloudflare");
    expect(m63PreflightDoc).toContain("VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>");
    expect(m63PreflightDoc).not.toMatch(committedD1DatabaseIdPattern);
    expect(m63PreflightDoc).not.toMatch(forbiddenProductionUrlPatterns);
  });
});
