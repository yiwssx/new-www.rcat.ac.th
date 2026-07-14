import { describe, expect, it } from "vitest";
import migrationSql from "../migrations/0001_public_read_schema.sql?raw";
import carouselResponsiveImageMigrationSql from "../migrations/0009_carousel_responsive_image_contract.sql?raw";
import sample from "../seed/public-documents.sample.json";
import wranglerToml from "../wrangler.toml?raw";
import {
  CAROUSEL_SLIDE_ROW_COLUMNS,
  CONTENT_ROW_COLUMNS,
  CONTENT_VIEW_DAILY_STATS_ROW_COLUMNS,
  CONTENT_VIEW_EVENT_ROW_COLUMNS,
  DISPLAY_SETTINGS_ROW_COLUMNS,
  DOCUMENT_ROW_COLUMNS,
  EVENT_ROW_COLUMNS,
  EXTERNAL_SERVICE_ROW_COLUMNS,
  HOMEPAGE_SETTINGS_ROW_COLUMNS,
  MEDIA_ASSET_ROW_COLUMNS,
  MENU_ITEM_ROW_COLUMNS,
  SITE_SETTINGS_ROW_COLUMNS,
  SYNC_RUN_ROW_COLUMNS,
  VISITOR_DAILY_STATS_ROW_COLUMNS,
  VISITOR_EVENT_ROW_COLUMNS
} from "../src/db/schema";
import worker from "../src/index";

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

const expectedColumnsByTable = {
  documents: [
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
  ],
  contents: [
    "id",
    "slug",
    "type",
    "status",
    "title",
    "summary",
    "body_snapshot",
    "category",
    "tags_json",
    "seo_title",
    "seo_description",
    "canonical_url",
    "featured",
    "reading_minutes",
    "template",
    "body_doc_id",
    "body_doc_url",
    "featured_media_id",
    "media_ids_json",
    "view_count",
    "last_viewed_at",
    "updated_at",
    "publish_at"
  ],
  media_assets: [
    "id",
    "name",
    "type",
    "size",
    "owner",
    "drive_url",
    "file_id",
    "mime_type",
    "preview_url",
    "embed_url",
    "thumbnail_url",
    "updated_at"
  ],
  site_settings: ["id", "settings_json", "updated_at"],
  homepage_settings: ["id", "settings_json", "updated_at"],
  display_settings: ["id", "settings_json", "updated_at"],
  menu_items: ["id", "parent_id", "label", "href", "enabled", "sort_order", "children_json", "updated_at"],
  carousel_slides: [
    "id",
    "title",
    "subtitle",
    "chip",
    "image_url",
    "image_alt",
    "button_label",
    "href",
    "image_fit",
    "focal_point_x",
    "focal_point_y",
    "mobile_image_url",
    "background_color",
    "open_in_new_tab",
    "enabled",
    "sort_order",
    "start_at",
    "end_at",
    "updated_at"
  ],
  external_services: ["id", "title", "description", "href", "tone", "icon_key", "enabled", "sort_order", "updated_at"],
  events: [
    "id",
    "title",
    "date",
    "end_date",
    "audience",
    "status",
    "location",
    "description",
    "category",
    "visibility",
    "updated_at"
  ],
  visitor_events: ["id", "visitor_id", "path", "referrer_origin", "page_title", "created_at"],
  visitor_daily_stats: ["day", "total_views", "unique_visitors", "online_users", "updated_at"],
  content_view_events: ["id", "content_id", "slug", "created_at"],
  content_view_daily_stats: ["day", "content_id", "slug", "view_count", "updated_at"],
  sync_runs: [
    "id",
    "source",
    "status",
    "started_at",
    "finished_at",
    "records_read",
    "records_written",
    "error",
    "metadata_json"
  ]
} as const;

const rowColumnContracts = {
  documents: DOCUMENT_ROW_COLUMNS,
  contents: CONTENT_ROW_COLUMNS,
  media_assets: MEDIA_ASSET_ROW_COLUMNS,
  site_settings: SITE_SETTINGS_ROW_COLUMNS,
  homepage_settings: HOMEPAGE_SETTINGS_ROW_COLUMNS,
  display_settings: DISPLAY_SETTINGS_ROW_COLUMNS,
  menu_items: MENU_ITEM_ROW_COLUMNS,
  carousel_slides: CAROUSEL_SLIDE_ROW_COLUMNS,
  external_services: EXTERNAL_SERVICE_ROW_COLUMNS,
  events: EVENT_ROW_COLUMNS,
  visitor_events: VISITOR_EVENT_ROW_COLUMNS,
  visitor_daily_stats: VISITOR_DAILY_STATS_ROW_COLUMNS,
  content_view_events: CONTENT_VIEW_EVENT_ROW_COLUMNS,
  content_view_daily_stats: CONTENT_VIEW_DAILY_STATS_ROW_COLUMNS,
  sync_runs: SYNC_RUN_ROW_COLUMNS
} as const;

const expectedIndexes = [
  "idx_documents_public_order",
  "idx_documents_media_id",
  "idx_contents_public_list",
  "idx_contents_slug",
  "idx_contents_featured",
  "idx_media_assets_file_id",
  "idx_media_assets_type",
  "idx_media_assets_updated_at",
  "idx_menu_items_parent_order",
  "idx_menu_items_enabled_order",
  "idx_carousel_slides_enabled_order",
  "idx_external_services_enabled_order",
  "idx_events_public_date",
  "idx_visitor_events_created_at",
  "idx_visitor_events_visitor_created",
  "idx_visitor_events_path_created",
  "idx_content_view_events_content_created",
  "idx_content_view_events_slug_created",
  "idx_sync_runs_started_at",
  "idx_sync_runs_source_started"
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

function getAddedTableColumns(sql: string, tableName: string) {
  const matches = sql.matchAll(new RegExp(`ALTER TABLE\\s+${tableName}\\s+ADD COLUMN\\s+("?[^\\s"]+"?)`, "gi"));

  return Array.from(matches, (match) => match[1].replaceAll('"', ""));
}

function getMigratedTableColumns(tableName: string) {
  return [
    ...getTableColumns(migrationSql, tableName),
    ...getAddedTableColumns(carouselResponsiveImageMigrationSql, tableName)
  ];
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

describe("M2.1 D1 schema and sample safety contract", () => {
  it("defines one ordered schema-only migration with the public-read tables", () => {
    expectedTables.forEach((tableName) => {
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\b`, "i"));
    });
    expectedIndexes.forEach((indexName) => {
      expect(migrationSql).toMatch(new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}\\b`, "i"));
    });
    expect(migrationSql).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it("keeps the D1 binding local-only with no real production database id", () => {
    expect(wranglerToml).toMatch(/^\[\[d1_databases\]\]/m);
    expect(wranglerToml).toMatch(/^\s*database_name\s*=\s*"rcat-public-api-local"\s*$/m);
    expect(wranglerToml).toMatch(/^\s*database_id\s*=\s*"local-placeholder"\s*$/m);
    expect(wranglerToml).not.toMatch(/^\s*database_id\s*=\s*"[0-9a-f-]{32,}"\s*$/m);
  });

  it("keeps Worker row column constants aligned to the migration chain", () => {
    Object.entries(rowColumnContracts).forEach(([tableName, rowColumns]) => {
      const expectedColumns = expectedColumnsByTable[tableName as keyof typeof expectedColumnsByTable];
      const migratedColumns = getMigratedTableColumns(tableName);

      expect(rowColumns).toEqual(expectedColumns);
      expect(migratedColumns).toHaveLength(expectedColumns.length);
      expect(migratedColumns).toEqual(expect.arrayContaining([...expectedColumns]));
    });
  });

  it("keeps contents compatible with ContentItem fields", () => {
    const columns = getTableColumns(migrationSql, "contents");

    expect(columns).toEqual(expect.arrayContaining([...expectedColumnsByTable.contents]));
    expect(columns).not.toEqual(
      expect.arrayContaining(["content_type", "body_json", "cover_media_id", "published_at"])
    );
  });

  it("keeps media assets compatible with MediaAsset fields and metadata-only storage", () => {
    const columns = getTableColumns(migrationSql, "media_assets");

    expect(columns).toEqual(expect.arrayContaining([...expectedColumnsByTable.media_assets]));
    expect(columns).not.toEqual(
      expect.arrayContaining(["media_type", "size_bytes", "drive_file_id", "public_url", "alt_text"])
    );
  });

  it("stores settings snapshots as JSON for phase 1 compatibility", () => {
    expect(getTableColumns(migrationSql, "site_settings")).toEqual(expectedColumnsByTable.site_settings);
    expect(getTableColumns(migrationSql, "homepage_settings")).toEqual(expectedColumnsByTable.homepage_settings);
    expect(getTableColumns(migrationSql, "display_settings")).toEqual(expectedColumnsByTable.display_settings);
  });

  it("keeps visitor daily stats compatible with public-home composition", () => {
    expect(getTableColumns(migrationSql, "visitor_daily_stats")).toEqual(expectedColumnsByTable.visitor_daily_stats);
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
    expect(Object.prototype.hasOwnProperty.call(typedSample, "items")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(typedSample, "generatedAt")).toBe(false);
    typedSample.rows?.forEach((row) => {
      expect(Object.keys(row)).toEqual(DOCUMENT_ROW_COLUMNS);
    });
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => {
      expect(new URL(url).hostname).toMatch(/(^|\.)example\.test$/);
    });
    expect(sampleText).not.toMatch(/rcat\.ac\.th|script\.google\.com|drive\.google\.com/i);
  });

  it("keeps the public documents route from falling back to fake data without DB", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {});

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "D1 DB binding is not configured",
      resource: "public-document-list",
      phase: "M3"
    });
  });
});
