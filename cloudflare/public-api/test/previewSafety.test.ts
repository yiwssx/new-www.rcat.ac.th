import { describe, expect, it } from "vitest";
import previewSeedSql from "../seed/public-documents.preview.seed.sql?raw";
import wranglerToml from "../wrangler.toml?raw";
import { DOCUMENT_ROW_COLUMNS } from "../src/db/schema";
import worker from "../src/index";

const forbiddenProductionPatterns = /rcat\.ac\.th|script\.google\.com|drive\.google\.com|workers\.dev/i;

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
