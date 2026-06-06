import { describe, expect, it } from "vitest";
import migrationSql from "../migrations/0001_public_read_schema.sql?raw";
import sample from "../seed/public-documents.sample.json";
import wranglerToml from "../wrangler.toml?raw";
import { DOCUMENT_ROW_COLUMNS } from "../src/db/schema";
import worker from "../src/index";

const expectedDocumentColumns = [
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "status",
  "sort_order",
  "pinned",
  "updated_at"
] as const;

const expectedTables = [
  "documents",
  "contents",
  "media_assets",
  "site_settings",
  "homepage_settings",
  "display_settings",
  "menu_items",
  "carousel_slides",
  "external_services",
  "events",
  "visitor_events",
  "visitor_daily_stats",
  "content_view_events",
  "content_view_daily_stats",
  "sync_runs"
] as const;

function getTableColumns(sql: string, tableName: string) {
  const match = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\s*\\(([\\s\\S]*?)\\);`, "i").exec(sql);

  if (!match) {
    return [];
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .filter((line) => !line.startsWith("--"))
    .filter((line) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line))
    .map((line) => line.split(/\s+/)[0].replaceAll('"', ""));
}

function collectUrls(value: unknown, urls: string[] = []) {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      urls.push(value);
    }

    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectUrls(entry, urls));
    return urls;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectUrls(entry, urls));
  }

  return urls;
}

describe("M2 D1 schema and sample safety contract", () => {
  it("defines one ordered schema-only migration with the public-read tables", () => {
    expectedTables.forEach((tableName) => {
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\b`, "i"));
    });
    expect(migrationSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_documents_public_list\b/i);
    expect(migrationSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_contents_public_list\b/i);
    expect(migrationSql).toMatch(/CREATE INDEX IF NOT EXISTS idx_media_assets_drive_file_id\b/i);
    expect(migrationSql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("keeps the D1 binding deferred in Wrangler config", () => {
    expect(wranglerToml).toMatch(/^# \[\[d1_databases\]\]/m);
    expect(wranglerToml).not.toMatch(/^\s*\[\[d1_databases\]\]/m);
    expect(wranglerToml).not.toMatch(/^\s*database_id\s*=\s*"[^<][^"]+"/m);
  });

  it("keeps the documents row column constant aligned to the migration", () => {
    expect(DOCUMENT_ROW_COLUMNS).toEqual(expectedDocumentColumns);
    expect(getTableColumns(migrationSql, "documents")).toEqual(expectedDocumentColumns);
  });

  it("keeps the local sample JSON fake and marked sample-only", () => {
    const sampleText = JSON.stringify(sample);
    const typedSample = sample as {
      sampleOnly?: boolean;
      rows?: Array<Record<string, unknown>>;
    };
    const urls = collectUrls(typedSample);

    expect(typedSample.sampleOnly).toBe(true);
    expect(typedSample.rows?.length).toBeGreaterThan(0);
    typedSample.rows?.forEach((row) => {
      expect(Object.keys(row)).toEqual(DOCUMENT_ROW_COLUMNS);
    });
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => {
      expect(new URL(url).hostname).toMatch(/(^|\.)example\.test$/);
    });
    expect(sampleText).not.toMatch(/rcat\.ac\.th|script\.google\.com|drive\.google\.com/i);
  });

  it("keeps the public documents route at an explicit 501 until M3 wiring", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {});

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: "public-document-list is not implemented in M1 skeleton",
      resource: "public-document-list",
      phase: "M1"
    });
  });
});
