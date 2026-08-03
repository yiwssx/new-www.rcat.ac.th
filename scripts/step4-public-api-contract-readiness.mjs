import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith("\n") ? content : `${content}\n`);
};
const replace = (file, from, to) => {
  const source = read(file);
  if (!source.includes(from)) {
    throw new Error(`Missing expected source in ${file}: ${from.slice(0, 160)}`);
  }
  write(file, source.replace(from, to));
};

write(
  "cloudflare/public-api/src/contracts/publicContent.ts",
  `import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMediaAssetContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicContentItemContract {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: "published";
  owner: string;
  summary: string;
  body: string;
  content: string;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  featured: boolean;
  readingMinutes: number;
  template: string;
  featuredMediaId: string;
  mediaIds: string[];
  viewCount: number;
  lastViewedAt: string;
  publishAt: string;
  publishedAt: string;
  updatedAt: string;
}

export type PublicContentSummaryContract = Omit<PublicContentItemContract, "body" | "content">;

export interface PublicContentPaginationContract {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PublicContentListSnapshotContract {
  kind: "news" | "announcements" | "blog";
  items: PublicContentSummaryContract[];
  pageItems?: PublicContentSummaryContract[];
  pagination?: PublicContentPaginationContract;
  media: PublicMediaAssetContract[];
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}

export interface PublicContentDetailSnapshotContract {
  item: PublicContentItemContract;
  media: PublicMediaAssetContract[];
  generatedAt: string;
}
`
);

write(
  "cloudflare/public-api/src/contracts/publicHome.ts",
  `import type { PublicContentSummaryContract } from "./publicContent";
import type { PublicDocumentItemContract } from "./publicDocuments";
import type {
  PublicCarouselSlideContract,
  PublicDisplaySettingsContract,
  PublicEventContract,
  PublicExternalServiceContract,
  PublicHomepageSettingsContract,
  PublicMediaAssetContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";
import type { PublicVisitorStatsSnapshotContract } from "./publicVisitorStats";

export interface PublicHomeSectionContract {
  id: string;
  key: string;
  title: string;
  summary: string;
  href: string;
  order: number;
  updatedAt: string;
}

export interface PublicHomeSnapshotContract {
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  carouselSlides: PublicCarouselSlideContract[];
  externalServices: PublicExternalServiceContract[];
  visitorStats: PublicVisitorStatsSnapshotContract;
  latestNews: PublicContentSummaryContract[];
  latestAnnouncements: PublicContentSummaryContract[];
  procurementItems: PublicContentSummaryContract[];
  jobOpportunityItems: PublicContentSummaryContract[];
  achievementItems: PublicContentSummaryContract[];
  programItems: PublicContentSummaryContract[];
  documentItems: PublicDocumentItemContract[];
  eventItems: PublicEventContract[];
  media: PublicMediaAssetContract[];
  sections: PublicHomeSectionContract[];
  featuredContent: PublicContentSummaryContract[];
  featuredDocuments: PublicDocumentItemContract[];
  programs: PublicContentSummaryContract[];
  generatedAt: string;
}
`
);

write(
  "cloudflare/public-api/src/contracts/publicSearch.ts",
  `import type { PublicContentSummaryContract } from "./publicContent";
import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicSearchSnapshotContract {
  query: string;
  items: PublicContentSummaryContract[];
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
`
);

write(
  "cloudflare/public-api/src/contracts/publicPrograms.ts",
  `import type { PublicContentSummaryContract } from "./publicContent";
import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMediaAssetContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicProgramListSnapshotContract {
  items: PublicContentSummaryContract[];
  media: PublicMediaAssetContract[];
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
`
);

write(
  "cloudflare/public-api/src/contracts/publicShell.ts",
  `import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicShellSnapshotContract {
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
`
);

write(
  "cloudflare/public-api/src/contracts/publicRead.ts",
  `export type PublicReadResource =
  | "public-document-list"
  | "public-home"
  | "public-shell"
  | "content-list"
  | "content-detail"
  | "search"
  | "program"
  | "visitor-stats";

export interface PublicReadRouteContract {
  resource: PublicReadResource;
  method: "GET";
  pathPattern: string;
  phase: "M17-B" | "SSR-readiness";
  responseType:
    | "PublicDocumentListSnapshot"
    | "PublicHomeSnapshot"
    | "PublicShellSnapshot"
    | "PublicContentListSnapshot"
    | "PublicContentDetailSnapshot"
    | "PublicSearchSnapshot"
    | "PublicProgramListSnapshot"
    | "PublicVisitorStatsSnapshot";
  implemented: boolean;
}
`
);

write(
  "cloudflare/public-api/src/routes/publicReadRegistry.ts",
  `import type { PublicReadRouteContract } from "../contracts/publicRead";

export const PUBLIC_READ_ROUTE_REGISTRY = [
  {
    resource: "public-document-list",
    method: "GET",
    pathPattern: "/api/public/documents",
    phase: "M17-B",
    responseType: "PublicDocumentListSnapshot",
    implemented: true
  },
  {
    resource: "public-home",
    method: "GET",
    pathPattern: "/api/public/home",
    phase: "M17-B",
    responseType: "PublicHomeSnapshot",
    implemented: true
  },
  {
    resource: "public-shell",
    method: "GET",
    pathPattern: "/api/public/shell",
    phase: "SSR-readiness",
    responseType: "PublicShellSnapshot",
    implemented: true
  },
  {
    resource: "content-list",
    method: "GET",
    pathPattern: "/api/public/content",
    phase: "M17-B",
    responseType: "PublicContentListSnapshot",
    implemented: true
  },
  {
    resource: "content-detail",
    method: "GET",
    pathPattern: "/api/public/content/:slug",
    phase: "M17-B",
    responseType: "PublicContentDetailSnapshot",
    implemented: true
  },
  {
    resource: "search",
    method: "GET",
    pathPattern: "/api/public/search",
    phase: "M17-B",
    responseType: "PublicSearchSnapshot",
    implemented: true
  },
  {
    resource: "program",
    method: "GET",
    pathPattern: "/api/public/programs",
    phase: "M17-B",
    responseType: "PublicProgramListSnapshot",
    implemented: true
  },
  {
    resource: "visitor-stats",
    method: "GET",
    pathPattern: "/api/public/visitor-stats",
    phase: "M17-B",
    responseType: "PublicVisitorStatsSnapshot",
    implemented: true
  }
] as const satisfies readonly PublicReadRouteContract[];
`
);

write(
  "cloudflare/public-api/src/db/contentRepository.ts",
  `import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";
import { CONTENT_ROW_COLUMNS, type ContentRow } from "./schema";

const PROGRAM_TYPE = "program";

export type PublicContentReadRow = Pick<
  ContentRow,
  | "id"
  | "slug"
  | "type"
  | "status"
  | "owner"
  | "title"
  | "summary"
  | "body_snapshot"
  | "category"
  | "tags_json"
  | "seo_title"
  | "seo_description"
  | "canonical_url"
  | "featured"
  | "reading_minutes"
  | "template"
  | "featured_media_id"
  | "media_ids_json"
  | "view_count"
  | "last_viewed_at"
  | "publish_at"
  | "updated_at"
>;

export type PublicContentSummaryReadRow = Omit<PublicContentReadRow, "body_snapshot">;

const PUBLIC_CONTENT_READ_COLUMNS = [
  "id",
  "slug",
  "type",
  "status",
  "owner",
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
  "featured_media_id",
  "media_ids_json",
  "view_count",
  "last_viewed_at",
  "publish_at",
  "updated_at"
] as const satisfies readonly (keyof PublicContentReadRow)[];

export const PUBLIC_CONTENT_SUMMARY_READ_COLUMNS = PUBLIC_CONTENT_READ_COLUMNS.filter(
  (column) => column !== "body_snapshot"
) as readonly (keyof PublicContentSummaryReadRow)[];

export async function listPublishedContentRows(env: Env, type: string): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC\`
    )
    .bind(...publicPublishedContentBindings(type))
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function listPublishedContentSummaryRows(
  env: Env,
  type: string
): Promise<PublicContentSummaryReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC\`
    )
    .bind(...publicPublishedContentBindings(type))
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}

export async function listAllPublishedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC\`
    )
    .bind(...publicPublishedContentBindings())
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function listAllPublishedContentSummaryRows(env: Env): Promise<PublicContentSummaryReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC\`
    )
    .bind(...publicPublishedContentBindings())
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}

export async function listFeaturedContentRows(env: Env): Promise<PublicContentReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND featured = ?
         AND type <> ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC
       LIMIT 6\`
    )
    .bind(...publicPublishedContentBindings(1, PROGRAM_TYPE))
    .all<PublicContentReadRow>();

  return result.results ?? [];
}

export async function getPublishedContentRowBySlug(env: Env, slug: string): Promise<PublicContentReadRow | null> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND (slug = ? OR id = ?)
         AND COALESCE(deleted_at, '') = ''
       LIMIT 1\`
    )
    .bind(...publicPublishedContentBindings(slug, slug))
    .all<PublicContentReadRow>();

  return result.results?.[0] ?? null;
}

export async function searchPublishedContentRows(env: Env, query: string): Promise<PublicContentSummaryReadRow[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return listAllPublishedContentSummaryRows(env);
  }

  const pattern = \`%\${normalizedQuery}%\`;
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND COALESCE(deleted_at, '') = ''
         AND (
           title LIKE ?
           OR summary LIKE ?
           OR body_snapshot LIKE ?
           OR category LIKE ?
           OR tags_json LIKE ?
         )
       ORDER BY publish_at DESC, updated_at DESC\`
    )
    .bind(...publicPublishedContentBindings(pattern, pattern, pattern, pattern, pattern))
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}

export function validateContentReadColumnContract() {
  return PUBLIC_CONTENT_READ_COLUMNS.filter((column) => column !== "owner").every((column) =>
    CONTENT_ROW_COLUMNS.includes(column as (typeof CONTENT_ROW_COLUMNS)[number])
  );
}
`
);

write(
  "cloudflare/public-api/src/db/programsRepository.ts",
  `import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  PUBLIC_CONTENT_SUMMARY_READ_COLUMNS,
  type PublicContentSummaryReadRow
} from "./contentRepository";
import { PUBLIC_PUBLISHED_CONTENT_FILTER_SQL, publicPublishedContentBindings } from "./publicContentVisibility";

const PROGRAM_TYPE = "program";

export async function listPublishedProgramRows(env: Env): Promise<PublicContentSummaryReadRow[]> {
  const db = requireD1Database(env);
  const result = await db
    .prepare(
      \`SELECT \${PUBLIC_CONTENT_SUMMARY_READ_COLUMNS.join(", ")}
       FROM contents
       WHERE \${PUBLIC_PUBLISHED_CONTENT_FILTER_SQL}
         AND type = ?
         AND COALESCE(deleted_at, '') = ''
       ORDER BY publish_at DESC, updated_at DESC\`
    )
    .bind(...publicPublishedContentBindings(PROGRAM_TYPE))
    .all<PublicContentSummaryReadRow>();

  return result.results ?? [];
}
`
);

write(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  `import type {
  PublicContentDetailSnapshotContract,
  PublicContentItemContract,
  PublicContentListSnapshotContract,
  PublicContentSummaryContract
} from "../contracts/publicContent";
import type { PublicMediaAssetContract, PublicMetadataContract } from "../contracts/publicMetadata";
import type { PublicContentReadRow, PublicContentSummaryReadRow } from "../db/contentRepository";
import { filterPublicMedia } from "./publicMetadataAdapter";

function parseStringArray(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function mapContentSummaryRowToPublicContentItem(
  row: PublicContentSummaryReadRow
): PublicContentSummaryContract {
  return {
    id: row.id || "",
    title: row.title || "",
    slug: row.slug || "",
    type: row.type || "page",
    status: "published",
    owner: row.owner || "",
    summary: row.summary || "",
    category: row.category || "",
    tags: parseStringArray(row.tags_json),
    seoTitle: row.seo_title || "",
    seoDescription: row.seo_description || "",
    canonicalUrl: row.canonical_url || "",
    featured: row.featured === 1,
    readingMinutes: Math.max(0, Number(row.reading_minutes) || 0),
    template: row.template || "",
    featuredMediaId: row.featured_media_id || "",
    mediaIds: parseStringArray(row.media_ids_json),
    viewCount: Math.max(0, Number(row.view_count) || 0),
    lastViewedAt: row.last_viewed_at || "",
    publishAt: row.publish_at || "",
    publishedAt: row.publish_at || "",
    updatedAt: row.updated_at || ""
  };
}

export function mapContentRowToPublicContentItem(row: PublicContentReadRow): PublicContentItemContract {
  return {
    ...mapContentSummaryRowToPublicContentItem(row),
    body: row.body_snapshot || "",
    content: row.body_snapshot || ""
  };
}

export function createPublicContentListSnapshot(
  kind: PublicContentListSnapshotContract["kind"],
  rows: PublicContentSummaryReadRow[],
  pageRows: PublicContentSummaryReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date(),
  pagination?: PublicContentListSnapshotContract["pagination"]
): PublicContentListSnapshotContract {
  const items = rows.map(mapContentSummaryRowToPublicContentItem);
  const pageItems = pageRows.map(mapContentSummaryRowToPublicContentItem);

  return {
    kind,
    items,
    ...(kind === "announcements" ? { pageItems } : {}),
    ...(pagination ? { pagination } : {}),
    media: filterPublicMedia(metadata.media, [...items, ...pageItems]),
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    generatedAt: generatedAt.toISOString()
  };
}

export function createPublicContentDetailSnapshot(
  row: PublicContentReadRow,
  media: PublicMediaAssetContract[] = [],
  generatedAt = new Date()
): PublicContentDetailSnapshotContract {
  const item = mapContentRowToPublicContentItem(row);

  return {
    item,
    media: filterPublicMedia(media, [item]),
    generatedAt: generatedAt.toISOString()
  };
}
`
);

write(
  "cloudflare/public-api/src/adapters/publicSearchAdapter.ts",
  `import { mapContentSummaryRowToPublicContentItem } from "./publicContentAdapter";
import type { PublicSearchSnapshotContract } from "../contracts/publicSearch";
import type { PublicContentSummaryReadRow } from "../db/contentRepository";
import type { PublicMetadataContract } from "../contracts/publicMetadata";

export function createPublicSearchSnapshot(
  query: string,
  rows: PublicContentSummaryReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date()
): PublicSearchSnapshotContract {
  return {
    query,
    items: rows.map(mapContentSummaryRowToPublicContentItem),
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    generatedAt: generatedAt.toISOString()
  };
}
`
);

write(
  "cloudflare/public-api/src/adapters/publicProgramsAdapter.ts",
  `import { mapContentSummaryRowToPublicContentItem } from "./publicContentAdapter";
import { filterPublicMedia } from "./publicMetadataAdapter";
import type { PublicProgramListSnapshotContract } from "../contracts/publicPrograms";
import type { PublicMetadataContract } from "../contracts/publicMetadata";
import type { PublicContentSummaryReadRow } from "../db/contentRepository";

export function createPublicProgramListSnapshot(
  rows: PublicContentSummaryReadRow[],
  metadata: PublicMetadataContract,
  generatedAt = new Date()
): PublicProgramListSnapshotContract {
  const items = rows.map(mapContentSummaryRowToPublicContentItem);

  return {
    items,
    media: filterPublicMedia(metadata.media, items),
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    generatedAt: generatedAt.toISOString()
  };
}
`
);

replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `import { mapContentRowToPublicContentItem } from "./publicContentAdapter";`,
  `import { mapContentSummaryRowToPublicContentItem } from "./publicContentAdapter";`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `import type { PublicContentItemContract } from "../contracts/publicContent";`,
  `import type { PublicContentSummaryContract } from "../contracts/publicContent";`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `import type { PublicContentReadRow } from "../db/contentRepository";`,
  `import type { PublicContentSummaryReadRow } from "../db/contentRepository";`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `function compareContentPublishAtDesc(left: PublicContentItemContract, right: PublicContentItemContract) {`,
  `function compareContentPublishAtDesc(left: PublicContentSummaryContract, right: PublicContentSummaryContract) {`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `function isAchievementItem(item: PublicContentItemContract) {`,
  `function isAchievementItem(item: PublicContentSummaryContract) {`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `    content: PublicContentReadRow[];`,
  `    content: PublicContentSummaryReadRow[];`
);
replace(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  `  const content = input.content.map(mapContentRowToPublicContentItem);`,
  `  const content = input.content.map(mapContentSummaryRowToPublicContentItem);`
);

replace(
  "cloudflare/public-api/src/db/publicMetadataRepository.ts",
  `export async function readPublicMetadataRows(env: Env): Promise<PublicMetadataRows> {`,
  `export type PublicShellMetadataRows = Pick<
  PublicMetadataRows,
  "siteSettings" | "homepageSettings" | "displaySettings" | "menu"
>;

export async function readPublicShellMetadataRows(env: Env): Promise<PublicShellMetadataRows> {
  const [siteSettings, homepageSettings, displaySettings, menu] = await Promise.all([
    readSingleton<SiteSettingsRow>(env, "site_settings", SITE_SETTINGS_ROW_COLUMNS),
    readSingleton<HomepageSettingsRow>(env, "homepage_settings", HOMEPAGE_SETTINGS_ROW_COLUMNS),
    readSingleton<DisplaySettingsRow>(env, "display_settings", DISPLAY_SETTINGS_ROW_COLUMNS),
    readRows<MenuItemRow>(
      env,
      \`SELECT \${MENU_ITEM_ROW_COLUMNS.join(", ")} FROM menu_items WHERE enabled = ? ORDER BY sort_order ASC\`,
      [1]
    )
  ]);

  return { siteSettings, homepageSettings, displaySettings, menu };
}

export async function readPublicMediaRows(env: Env): Promise<MediaAssetRow[]> {
  return readRows<MediaAssetRow>(
    env,
    \`SELECT \${MEDIA_ASSET_ROW_COLUMNS.join(", ")} FROM media_assets ORDER BY updated_at DESC\`
  );
}

export async function readPublicMetadataRows(env: Env): Promise<PublicMetadataRows> {`
);

write(
  "cloudflare/public-api/src/routes/publicContent.ts",
  `import { createPublicContentDetailSnapshot, createPublicContentListSnapshot } from "../adapters/publicContentAdapter";
import { mapMediaAssetRowToPublicMediaAsset } from "../adapters/publicMediaAdapter";
import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import { getPublishedContentRowBySlug, listPublishedContentSummaryRows } from "../db/contentRepository";
import { readPublicMediaRows, readPublicMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const CONTENT_LIST_RESOURCE = "content-list";
const CONTENT_DETAIL_RESOURCE = "content-detail";
const PHASE = "M17-B";

const CONTENT_KIND_TO_TYPE = {
  news: "news",
  announcements: "announcement",
  blog: "blog"
} as const;

function getOptionalPagination(request: Request, totalItems: number) {
  const url = new URL(request.url);
  const pageValue = url.searchParams.get("page");

  if (pageValue === null) {
    return undefined;
  }

  const requestedPage = Number(pageValue);

  if (!Number.isInteger(requestedPage) || requestedPage <= 0) {
    return undefined;
  }

  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const pageSize = Number.isInteger(requestedPageSize)
    ? Math.min(Math.max(requestedPageSize, 1), 100)
    : 20;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requestedPage, totalPages);

  return {
    page,
    pageSize,
    totalItems,
    totalPages
  };
}

export async function publicContentList(request: Request, env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }

  const kind = new URL(request.url).searchParams.get("kind")?.trim().toLowerCase() || "news";

  if (!(kind in CONTENT_KIND_TO_TYPE)) {
    return jsonError("invalid public content list kind", 400, {
      resource: CONTENT_LIST_RESOURCE
    });
  }

  const publicKind = kind as keyof typeof CONTENT_KIND_TO_TYPE;

  try {
    const [rows, pageRows, metadataRows] = await Promise.all([
      listPublishedContentSummaryRows(env, CONTENT_KIND_TO_TYPE[publicKind]),
      publicKind === "announcements" ? listPublishedContentSummaryRows(env, "page") : Promise.resolve([]),
      readPublicMetadataRows(env)
    ]);
    const pagination = getOptionalPagination(request, rows.length);
    const selectedRows = pagination
      ? rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
      : rows;

    return json(
      createPublicContentListSnapshot(
        publicKind,
        selectedRows,
        pageRows,
        createPublicMetadata(metadataRows),
        new Date(),
        pagination
      )
    );
  } catch {
    return jsonError("Unable to load content-list", 500, {
      resource: CONTENT_LIST_RESOURCE,
      phase: PHASE
    });
  }
}

export async function publicContentDetail(env: Env, slug: string) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }

  try {
    const row = await getPublishedContentRowBySlug(env, slug);

    if (!row) {
      return jsonError("not found", 404, {
        resource: CONTENT_DETAIL_RESOURCE
      });
    }

    const mediaRows = await readPublicMediaRows(env);
    const media = mediaRows.map(mapMediaAssetRowToPublicMediaAsset);
    return json(createPublicContentDetailSnapshot(row, media));
  } catch {
    return jsonError("Unable to load content-detail", 500, {
      resource: CONTENT_DETAIL_RESOURCE,
      phase: PHASE
    });
  }
}
`
);

replace(
  "cloudflare/public-api/src/routes/publicHome.ts",
  `import { listAllPublishedContentRows } from "../db/contentRepository";`,
  `import { listAllPublishedContentSummaryRows } from "../db/contentRepository";`
);
replace(
  "cloudflare/public-api/src/routes/publicHome.ts",
  `      listAllPublishedContentRows(env),`,
  `      listAllPublishedContentSummaryRows(env),`
);

write(
  "cloudflare/public-api/src/routes/publicShell.ts",
  `import { createPublicMetadata } from "../adapters/publicMetadataAdapter";
import type { PublicShellSnapshotContract } from "../contracts/publicShell";
import { readPublicShellMetadataRows } from "../db/publicMetadataRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const RESOURCE = "public-shell";

export async function publicShell(env: Env) {
  if (!env.DB) {
    return jsonError("database binding is not configured", 503, { resource: RESOURCE });
  }

  try {
    const rows = await readPublicShellMetadataRows(env);
    const metadata = createPublicMetadata({
      ...rows,
      media: [],
      carouselSlides: [],
      externalServices: [],
      events: []
    });
    const payload: PublicShellSnapshotContract = {
      siteSettings: metadata.siteSettings,
      homepageSettings: metadata.homepageSettings,
      displaySettings: metadata.displaySettings,
      menu: metadata.menu,
      generatedAt: new Date().toISOString()
    };

    return json(payload);
  } catch {
    return jsonError("Unable to load public-shell", 500, { resource: RESOURCE });
  }
}
`
);

replace(
  "cloudflare/public-api/src/router.ts",
  `import { publicSearch } from "./routes/publicSearch";`,
  `import { publicSearch } from "./routes/publicSearch";\nimport { publicShell } from "./routes/publicShell";`
);
replace(
  "cloudflare/public-api/src/router.ts",
  `  if (pathname === "/api/public/home") {\n    return publicHome(env);\n  }`,
  `  if (pathname === "/api/public/home") {\n    return publicHome(env);\n  }\n\n  if (pathname === "/api/public/shell") {\n    return publicShell(env);\n  }`
);

write(
  "src/features/public-content/types.ts",
  `import type { MediaAsset } from "../cms-media/types";
import type { PublicMenuItem } from "../cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "../cms-settings/types";

export type ContentStatus = "draft" | "review" | "scheduled" | "published";

export type ContentType = "page" | "news" | "program" | "announcement" | "blog";

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  owner: string;
  summary: string;
  body?: string;
  category?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  featured?: boolean;
  readingMinutes?: number;
  template?: string;
  bodyDocId?: string;
  bodyDocUrl?: string;
  featuredMediaId?: string;
  mediaIds?: string[];
  viewCount?: number;
  lastViewedAt?: string;
  updatedAt: string;
  publishAt: string;
  revision?: number;
}

export type PublicContentSummary = Omit<ContentItem, "body">;

export interface PublicContentPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type PublicContentListKind = "news" | "announcements" | "blog";

export interface PublicContentListSnapshot {
  kind: PublicContentListKind;
  items: PublicContentSummary[];
  pageItems?: PublicContentSummary[];
  pagination?: PublicContentPagination;
  media: MediaAsset[];
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  generatedAt: string;
}

export interface PublicContentDetailSnapshot {
  item: ContentItem;
  media: MediaAsset[];
  generatedAt: string;
}
`
);

write(
  "src/features/public-programs/types.ts",
  `import type { MediaAsset } from "../cms-media/types";
import type { PublicMenuItem } from "../cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "../cms-settings/types";
import type { PublicContentSummary } from "../public-content/types";

export interface PublicProgramListSnapshot {
  items: PublicContentSummary[];
  media: MediaAsset[];
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  generatedAt: string;
}
`
);

write(
  "src/features/public-search/types.ts",
  `import type { PublicMenuItem } from "../cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "../cms-settings/types";
import type { PublicContentSummary } from "../public-content/types";

export interface PublicSearchIndexSnapshot {
  query?: string;
  items: PublicContentSummary[];
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  generatedAt: string;
}
`
);

replace(
  "src/types.ts",
  `  ContentItem,\n  ContentStatus,\n  ContentType,\n  PublicContentListKind,\n  PublicContentListSnapshot`,
  `  ContentItem,\n  ContentStatus,\n  ContentType,\n  PublicContentDetailSnapshot,\n  PublicContentListKind,\n  PublicContentListSnapshot,\n  PublicContentPagination,\n  PublicContentSummary`
);
replace(
  "src/types.ts",
  `export interface PublicHomeSnapshot {`,
  `export interface PublicShellSnapshot {\n  siteSettings: SiteSettings;\n  homepageSettings: HomepageSettings;\n  displaySettings?: DisplaySettings;\n  menu: PublicMenuItem[];\n  generatedAt: string;\n}\n\nexport interface PublicHomeSnapshot {`
);
replace(
  "src/types.ts",
  `  latestNews: ContentItem[];\n  latestAnnouncements: ContentItem[];\n  procurementItems: ContentItem[];\n  jobOpportunityItems: ContentItem[];\n  achievementItems: ContentItem[];\n  programItems: ContentItem[];`,
  `  latestNews: import("./features/public-content/types").PublicContentSummary[];\n  latestAnnouncements: import("./features/public-content/types").PublicContentSummary[];\n  procurementItems: import("./features/public-content/types").PublicContentSummary[];\n  jobOpportunityItems: import("./features/public-content/types").PublicContentSummary[];\n  achievementItems: import("./features/public-content/types").PublicContentSummary[];\n  programItems: import("./features/public-content/types").PublicContentSummary[];`
);

write(
  "src/features/public-read/cloudflareApi.ts",
  `import { buildCloudflarePublicApiUrl } from "../../config/publicApiProvider";
import { projectSettings } from "../../config/projectSettings";
import type {
  ContentItem,
  DisplaySettings,
  PublicContentDetailSnapshot,
  PublicContentListKind,
  PublicContentListSnapshot,
  PublicHomeSnapshot,
  PublicProgramListSnapshot,
  PublicSearchIndexSnapshot,
  PublicShellSnapshot
} from "../../types";
import type { ContentViewResponse, SiteViewInput } from "../site-view/types";
import type { VisitorStatsSettings } from "../visitor-stats";
import { isPublicReadNotFoundError, PublicReadError } from "./errors";
import { getPublicJson, type PublicReadRequestOptions } from "./request";

const PRESENCE_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
let presenceBackoffUntil = 0;

export interface PublicContentListPageInput {
  page: number;
  pageSize?: number;
}

export function isCloudflarePublicApiNotFoundError(error: unknown) {
  return isPublicReadNotFoundError(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readErrorDetail(payload: unknown) {
  if (!isRecord(payload)) {
    return { error: "", diagnostic: "", suggestedMigration: "" };
  }

  return {
    error: typeof payload.error === "string" ? payload.error : "",
    diagnostic: typeof payload.diagnostic === "string" ? payload.diagnostic : "",
    suggestedMigration: typeof payload.suggestedMigration === "string" ? payload.suggestedMigration : ""
  };
}

function isVisitorPresenceUnavailable(error: unknown) {
  return (
    error instanceof PublicReadError &&
    (error.diagnostic === "visitor-presence-schema-missing-v1" ||
      /visitor[- ]presence[- ]schema[- ]missing|visitor presence schema/i.test(error.message))
  );
}

function warnPublicPresenceBackoff(error: unknown) {
  if (!import.meta.env.DEV) {
    return;
  }

  const detail = error instanceof PublicReadError && error.suggestedMigration ? \` \${error.suggestedMigration}\` : "";
  console.warn(\`Public presence tracking is temporarily disabled.\${detail}\`);
}

export function resetCloudflarePublicApiBackoffForTests() {
  presenceBackoffUntil = 0;
}

function persistDisplaySettings(displaySettings?: DisplaySettings) {
  if (typeof window !== "undefined" && displaySettings) {
    window.localStorage.setItem(
      projectSettings.storageKeys.displaySettings || "rcat.cms.display.settings",
      JSON.stringify(displaySettings)
    );
  }
}

async function postCloudflareJson<T>(path: string, resource: string, body: unknown): Promise<T> {
  const response = await fetch(buildCloudflarePublicApiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    keepalive: true
  });

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      // Keep the generic HTTP status message below when the body is not JSON.
    }

    const detail = readErrorDetail(payload);
    throw new PublicReadError(detail.error || \`Cloudflare \${resource} request failed with HTTP \${response.status}\`, {
      kind: "http",
      resource,
      status: response.status,
      diagnostic: detail.diagnostic,
      suggestedMigration: detail.suggestedMigration
    });
  }

  return (await response.json()) as T;
}

function assertPublicSnapshot(value: Record<string, unknown>, resource: string, requiredArrays: string[]) {
  if (typeof value.generatedAt !== "string") {
    throw new PublicReadError(\`Cloudflare \${resource} response is missing generatedAt\`, {
      kind: "invalid-response",
      resource
    });
  }

  requiredArrays.forEach((key) => {
    if (!Array.isArray(value[key])) {
      throw new PublicReadError(\`Cloudflare \${resource} response is missing \${key}\`, {
        kind: "invalid-response",
        resource
      });
    }
  });
}

function assertPublicSummaryItems(value: unknown, resource: string) {
  if (!Array.isArray(value)) {
    throw new PublicReadError(\`Cloudflare \${resource} response is missing items\`, {
      kind: "invalid-response",
      resource
    });
  }

  value.forEach((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.slug !== "string" ||
      Object.prototype.hasOwnProperty.call(item, "body") ||
      Object.prototype.hasOwnProperty.call(item, "content")
    ) {
      throw new PublicReadError(\`Cloudflare \${resource} returned an invalid summary item\`, {
        kind: "invalid-response",
        resource
      });
    }
  });
}

function assertOptionalPagination(value: unknown, resource: string) {
  if (value === undefined) {
    return;
  }

  if (
    !isRecord(value) ||
    !Number.isInteger(value.page) ||
    !Number.isInteger(value.pageSize) ||
    !Number.isInteger(value.totalItems) ||
    !Number.isInteger(value.totalPages)
  ) {
    throw new PublicReadError(\`Cloudflare \${resource} returned invalid pagination metadata\`, {
      kind: "invalid-response",
      resource
    });
  }
}

function buildContentListPath(kind: PublicContentListKind, pageInput?: PublicContentListPageInput) {
  const search = new URLSearchParams({ kind });

  if (pageInput) {
    search.set("page", String(Math.max(1, Math.floor(pageInput.page))));
    if (pageInput.pageSize !== undefined) {
      search.set("pageSize", String(Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)))));
    }
  }

  return \`/api/public/content?\${search.toString()}\`;
}

async function getPublicContentListAtPath(
  kind: PublicContentListKind,
  path: string,
  options: PublicReadRequestOptions
): Promise<PublicContentListSnapshot> {
  const payload = await getPublicJson(path, "content-list", options);
  assertPublicSnapshot(payload, "content-list", ["items", "media", "menu"]);

  if (payload.kind !== kind) {
    throw new PublicReadError("Cloudflare content-list response kind does not match the request", {
      kind: "invalid-response",
      resource: "content-list"
    });
  }

  assertPublicSummaryItems(payload.items, "content-list");
  if (payload.pageItems !== undefined) {
    assertPublicSummaryItems(payload.pageItems, "content-list");
  }
  assertOptionalPagination(payload.pagination, "content-list");
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicContentListSnapshot;
}

export async function getPublicShellSnapshotFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicShellSnapshot> {
  const payload = await getPublicJson("/api/public/shell", "public-shell", options);
  assertPublicSnapshot(payload, "public-shell", ["menu"]);

  if (!isRecord(payload.siteSettings) || !isRecord(payload.homepageSettings) || !isRecord(payload.displaySettings)) {
    throw new PublicReadError("Cloudflare public-shell response is missing settings", {
      kind: "invalid-response",
      resource: "public-shell"
    });
  }

  persistDisplaySettings(payload.displaySettings as DisplaySettings);
  return payload as unknown as PublicShellSnapshot;
}

export async function getPublicHomeSnapshotFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicHomeSnapshot> {
  const payload = await getPublicJson("/api/public/home", "public-home", options);
  assertPublicSnapshot(payload, "public-home", [
    "menu",
    "carouselSlides",
    "externalServices",
    "latestNews",
    "latestAnnouncements",
    "procurementItems",
    "jobOpportunityItems",
    "achievementItems",
    "programItems",
    "documentItems",
    "eventItems",
    "media"
  ]);
  [
    "latestNews",
    "latestAnnouncements",
    "procurementItems",
    "jobOpportunityItems",
    "achievementItems",
    "programItems"
  ].forEach((key) => assertPublicSummaryItems(payload[key], "public-home"));
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicHomeSnapshot;
}

export async function getPublicContentListSnapshotFromCloudflare(
  kind: PublicContentListKind,
  options: PublicReadRequestOptions = {}
): Promise<PublicContentListSnapshot> {
  return getPublicContentListAtPath(kind, buildContentListPath(kind), options);
}

export async function getPublicContentListPageSnapshotFromCloudflare(
  kind: PublicContentListKind,
  pageInput: PublicContentListPageInput,
  options: PublicReadRequestOptions = {}
): Promise<PublicContentListSnapshot> {
  return getPublicContentListAtPath(kind, buildContentListPath(kind, pageInput), options);
}

export async function getPublicContentDetailSnapshotFromCloudflare(
  input: { id?: string; slug?: string },
  options: PublicReadRequestOptions = {}
): Promise<PublicContentDetailSnapshot> {
  const identifier = input.slug?.trim() || input.id?.trim();

  if (!identifier) {
    throw new PublicReadError("Cloudflare content-detail requires an id or slug", {
      kind: "invalid-response",
      resource: "content-detail"
    });
  }

  const payload = await getPublicJson(
    \`/api/public/content/\${encodeURIComponent(identifier)}\`,
    "content-detail",
    options
  );

  if (!isRecord(payload.item) || !Array.isArray(payload.media) || typeof payload.generatedAt !== "string") {
    throw new PublicReadError("Cloudflare content-detail response is missing item or media", {
      kind: "invalid-response",
      resource: "content-detail"
    });
  }

  return payload as unknown as PublicContentDetailSnapshot;
}

export async function getContentDetailFromCloudflare(
  input: { id?: string; slug?: string },
  options: PublicReadRequestOptions = {}
): Promise<ContentItem> {
  const snapshot = await getPublicContentDetailSnapshotFromCloudflare(input, options);
  return snapshot.item;
}

export async function getPublicProgramListSnapshotFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<PublicProgramListSnapshot> {
  const payload = await getPublicJson("/api/public/programs", "program", options);
  assertPublicSnapshot(payload, "program", ["items", "media", "menu"]);
  assertPublicSummaryItems(payload.items, "program");
  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicProgramListSnapshot;
}

export async function getPublicSearchIndexSnapshotFromCloudflare(
  query = "",
  options: PublicReadRequestOptions = {}
): Promise<PublicSearchIndexSnapshot> {
  const normalizedQuery = query.trim();
  const path = normalizedQuery
    ? \`/api/public/search?q=\${encodeURIComponent(normalizedQuery)}\`
    : "/api/public/search";
  const payload = await getPublicJson(path, "search", options);
  assertPublicSnapshot(payload, "search", ["items", "menu"]);
  assertPublicSummaryItems(payload.items, "search");

  if (typeof payload.query === "string" && payload.query !== normalizedQuery) {
    throw new PublicReadError("Cloudflare search response query does not match the request", {
      kind: "invalid-response",
      resource: "search"
    });
  }

  persistDisplaySettings(payload.displaySettings as DisplaySettings | undefined);
  return payload as unknown as PublicSearchIndexSnapshot;
}

export async function getVisitorStatsFromCloudflare(
  options: PublicReadRequestOptions = {}
): Promise<VisitorStatsSettings> {
  const payload = await getPublicJson("/api/public/visitor-stats", "visitor-stats", options);

  if (
    typeof payload.onlineUsers !== "number" ||
    typeof payload.usersToday !== "number" ||
    typeof payload.totalViews !== "number" ||
    typeof payload.updatedAt !== "string"
  ) {
    throw new PublicReadError("Cloudflare visitor-stats returned an invalid response", {
      kind: "invalid-response",
      resource: "visitor-stats"
    });
  }

  return payload as unknown as VisitorStatsSettings;
}

export function recordSiteViewToCloudflare(input: SiteViewInput): boolean {
  try {
    void postCloudflareJson("/api/public/site-view", "site-view", input).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function recordPresenceToCloudflare(input: Pick<SiteViewInput, "visitorId" | "path">): boolean {
  try {
    if (Date.now() < presenceBackoffUntil) {
      return false;
    }

    void postCloudflareJson("/api/public/presence", "presence", input).catch((error) => {
      if (isVisitorPresenceUnavailable(error)) {
        presenceBackoffUntil = Date.now() + PRESENCE_FAILURE_BACKOFF_MS;
        warnPublicPresenceBackoff(error);
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function recordContentViewToCloudflare(input: { id?: string; slug?: string }): Promise<ContentViewResponse> {
  return postCloudflareJson<ContentViewResponse>("/api/public/content-view", "content-view", input);
}
`
);

write(
  "src/features/public-content/api.ts",
  `import {
  getContentDetailFromCloudflare,
  getPublicContentDetailSnapshotFromCloudflare,
  getPublicContentListPageSnapshotFromCloudflare,
  getPublicContentListSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError,
  type PublicContentListPageInput
} from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { PublicContentListKind } from "./types";

export function getPublicContentListSnapshot(kind: PublicContentListKind, options: PublicReadRequestOptions = {}) {
  return getPublicContentListSnapshotFromCloudflare(kind, options);
}

export function getPublicContentListPageSnapshot(
  kind: PublicContentListKind,
  pageInput: PublicContentListPageInput,
  options: PublicReadRequestOptions = {}
) {
  return getPublicContentListPageSnapshotFromCloudflare(kind, pageInput, options);
}

export function getPublicContentDetailSnapshot(
  input: { id?: string; slug?: string },
  options: PublicReadRequestOptions = {}
) {
  return getPublicContentDetailSnapshotFromCloudflare(input, options);
}

export function getContentDetail(input: { id?: string; slug?: string }, options: PublicReadRequestOptions = {}) {
  return getContentDetailFromCloudflare(input, options);
}

export function isPublicContentNotFoundError(error: unknown) {
  return isCloudflarePublicApiNotFoundError(error);
}
`
);
replace(
  "src/features/public-content/index.ts",
  `export { getContentDetail, getPublicContentListSnapshot, isPublicContentNotFoundError } from "./api";`,
  `export {\n  getContentDetail,\n  getPublicContentDetailSnapshot,\n  getPublicContentListPageSnapshot,\n  getPublicContentListSnapshot,\n  isPublicContentNotFoundError\n} from "./api";`
);
replace(
  "src/features/public-content/index.ts",
  `  ContentType,\n  PublicContentListKind,\n  PublicContentListSnapshot`,
  `  ContentType,\n  PublicContentDetailSnapshot,\n  PublicContentListKind,\n  PublicContentListSnapshot,\n  PublicContentPagination,\n  PublicContentSummary`
);

write(
  "src/features/public-shell/api.ts",
  `import {
  getPublicHomeSnapshotFromCloudflare,
  getPublicShellSnapshotFromCloudflare,
  isCloudflarePublicApiNotFoundError
} from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { PublicShellSnapshot } from "../../types";

export async function getPublicShellSnapshot(
  options: PublicReadRequestOptions = {}
): Promise<PublicShellSnapshot> {
  try {
    return await getPublicShellSnapshotFromCloudflare(options);
  } catch (error) {
    if (!isCloudflarePublicApiNotFoundError(error)) {
      throw error;
    }

    const home = await getPublicHomeSnapshotFromCloudflare(options);
    return {
      siteSettings: home.siteSettings,
      homepageSettings: home.homepageSettings,
      displaySettings: home.displaySettings,
      menu: home.menu,
      generatedAt: home.generatedAt
    };
  }
}
`
);
write(
  "src/features/public-shell/query.ts",
  `import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicShellSnapshot } from "./api";

export const publicShellQueryKey = ["public-shell"] as const;

export function publicShellQueryOptions(runtimeOptions: PublicQueryRuntimeOptions = {}) {
  return queryOptions({
    queryKey: publicShellQueryKey,
    queryFn: (context) => getPublicShellSnapshot(getPublicQueryRequestOptions(context, runtimeOptions)),
    staleTime: 15 * 60 * 1000,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
`
);
write(
  "src/features/public-shell/index.ts",
  `export { getPublicShellSnapshot } from "./api";
export { publicShellQueryKey, publicShellQueryOptions } from "./query";
export type { PublicShellSnapshot } from "../../types";
`
);

write(
  "src/features/public-search/api.ts",
  `import { getPublicSearchIndexSnapshotFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";

export function getPublicSearchIndexSnapshot(query = "", options: PublicReadRequestOptions = {}) {
  return getPublicSearchIndexSnapshotFromCloudflare(query, options);
}
`
);
write(
  "src/features/public-search/query.ts",
  `import { queryOptions } from "@tanstack/react-query";
import {
  getPublicQueryRequestOptions,
  PUBLIC_QUERY_GC_TIME_MS,
  type PublicQueryRuntimeOptions
} from "../public-read/queryPolicy";
import { getPublicSearchIndexSnapshot } from "./api";
import { PUBLIC_SEARCH_INDEX_CACHE_TTL_MS, setPublicSearchIndexCache } from "./cache";

export const publicSearchIndexQueryKey = ["public-search-index"] as const;

export function getPublicSearchQueryKey(query = "") {
  const normalizedQuery = query.trim();
  return normalizedQuery ? ([...publicSearchIndexQueryKey, normalizedQuery] as const) : publicSearchIndexQueryKey;
}

export function publicSearchIndexQueryOptions(
  query = "",
  runtimeOptions: PublicQueryRuntimeOptions = {}
) {
  const normalizedQuery = query.trim();

  return queryOptions({
    queryKey: getPublicSearchQueryKey(normalizedQuery),
    queryFn: async (context) => {
      const snapshot = await getPublicSearchIndexSnapshot(
        normalizedQuery,
        getPublicQueryRequestOptions(context, runtimeOptions)
      );
      if (!normalizedQuery) {
        setPublicSearchIndexCache(snapshot);
      }
      return snapshot;
    },
    staleTime: PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
    gcTime: PUBLIC_QUERY_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });
}
`
);
write(
  "src/public/hooks/usePublicSearchIndex.ts",
  `import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicSearchIndexCache,
  PUBLIC_SEARCH_INDEX_CACHE_TTL_MS,
  publicSearchIndexQueryOptions
} from "../../features/public-search";
import { isPublicQueryCacheFresh } from "../../features/public-read/queryPolicy";

export function usePublicSearchIndex(query = "") {
  const normalizedQuery = query.trim();
  const cachedSnapshot = useMemo(
    () => (normalizedQuery ? null : getPublicSearchIndexCache()),
    [normalizedQuery]
  );
  const hasFreshCache = cachedSnapshot
    ? isPublicQueryCacheFresh(cachedSnapshot.savedAt, PUBLIC_SEARCH_INDEX_CACHE_TTL_MS)
    : false;

  return useQuery({
    ...publicSearchIndexQueryOptions(normalizedQuery, { consumeAbortSignal: false }),
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.savedAt,
    refetchOnMount: cachedSnapshot ? !hasFreshCache : true
  });
}
`
);
replace(
  "src/public/pages/PublicSearchPage.tsx",
  `import { FormEvent, useMemo, useState } from "react";`,
  `import { FormEvent, useState } from "react";`
);
replace(
  "src/public/pages/PublicSearchPage.tsx",
  `import { searchPublishedContent } from "../../utils/search";\n`,
  ``
);
replace(
  "src/public/pages/PublicSearchPage.tsx",
  `  const navigate = useNavigate();\n  const { data, isLoading, isFetching, isError, refetch } = usePublicSearchIndex();\n  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });\n  const query = getSearchQueryFromLocation(search);`,
  `  const navigate = useNavigate();\n  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });\n  const query = getSearchQueryFromLocation(search);\n  const { data, isLoading, isFetching, isError, refetch } = usePublicSearchIndex(query);`
);
replace(
  "src/public/pages/PublicSearchPage.tsx",
  `  const results = useMemo(() => searchPublishedContent(data?.items ?? [], query), [data?.items, query]);`,
  `  const results = data?.items ?? [];`
);

replace(
  "src/test/publicQueryOptions.test.ts",
  `import { publicSearchIndexQueryOptions } from "../features/public-search/query";`,
  `import { publicSearchIndexQueryOptions } from "../features/public-search/query";\nimport { publicShellQueryOptions } from "../features/public-shell/query";`
);
replace(
  "src/test/publicQueryOptions.test.ts",
  `      publicSearchIndexQueryOptions(),\n      publicEventListQueryOptions(),`,
  `      publicSearchIndexQueryOptions(),\n      publicShellQueryOptions(),\n      publicEventListQueryOptions(),`
);
replace(
  "src/test/publicQueryOptions.test.ts",
  `      ["public-search-index"],\n      ["public-event-list"],`,
  `      ["public-search-index"],\n      ["public-shell"],\n      ["public-event-list"],`
);
replace(
  "src/test/publicQueryOptions.test.ts",
  `    expect(publicContentDetailQueryOptions(undefined).enabled).toBe(false);`,
  `    expect(publicContentDetailQueryOptions(undefined).enabled).toBe(false);\n    expect(publicSearchIndexQueryOptions("  award  ").queryKey).toEqual(["public-search-index", "award"]);`
);

replace(
  "src/features/public-read/publicReadProviderParity.test.ts",
  `const searchSnapshot = {\n  ...sharedMetadata,\n  items: [publicItem]\n};`,
  `const searchSnapshot = {\n  ...sharedMetadata,\n  query: "",\n  items: [publicItem]\n};`
);

replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `      "public-home",\n      "content-list",`,
  `      "public-home",\n      "public-shell",\n      "content-list",`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `          status: "published",\n          owner: "",\n          body: "Fake local-only public content body.",\n          content: "Fake local-only public content body."`,
  `          status: "published",\n          owner: ""`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-001" })]);\n    expect(JSON.stringify(payload)).not.toContain("sample-program");`,
  `    const listedItem = (payload.items as Array<Record<string, unknown>>)[0];\n    expect(listedItem).not.toHaveProperty("body");\n    expect(listedItem).not.toHaveProperty("content");\n    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-001" })]);\n    expect(JSON.stringify(payload)).not.toContain("sample-program");`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("returns a public content detail item or a safe 404", async () => {`,
  `    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("supports opt-in content pagination without changing the unpaginated contract", async () => {\n    const paginatedRows = [1, 2, 3].map((number) => ({\n      ...sampleContentRows[0],\n      id: \`sample-news-00\${number}\`,\n      slug: \`sample-news-\${number}\`,\n      title: \`Sample public news \${number}\`\n    }));\n    const { env } = createPublicReadMockDb({ contentRows: paginatedRows });\n    const response = await worker.fetch(\n      new Request("https://public-api.example.test/api/public/content?kind=news&page=2&pageSize=1"),\n      env\n    );\n    const { payload } = await readTextAndJson(response);\n\n    expect(response.status).toBe(200);\n    expect(payload.items).toEqual([expect.objectContaining({ id: "sample-news-002" })]);\n    expect(payload.pagination).toEqual({ page: 2, pageSize: 1, totalItems: 3, totalPages: 3 });\n  });\n\n  it("returns a public content detail item or a safe 404", async () => {`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `        updatedAt: "2026-02-02T00:00:00.000Z"\n      }\n    });`,
  `        updatedAt: "2026-02-02T00:00:00.000Z"\n      },\n      media: [expect.objectContaining({ id: "sample-media-001" })]\n    });`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("includes newly published news on the homepage without requiring featured metadata", async () => {`,
  `    const homeNews = (payload.latestNews as Array<Record<string, unknown>>)[0];\n    expect(homeNews).not.toHaveProperty("body");\n    expect(homeNews).not.toHaveProperty("content");\n    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("returns lightweight shell metadata without loading content or public media collections", async () => {\n    const { env, calls } = createPublicReadMockDb();\n    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/shell"), env);\n    const { payload, text } = await readTextAndJson(response);\n\n    expect(response.status).toBe(200);\n    expect(payload).toMatchObject({\n      siteSettings: expect.any(Object),\n      homepageSettings: expect.any(Object),\n      displaySettings: expect.any(Object),\n      menu: expect.any(Array)\n    });\n    expect(calls.some((call) => /FROM\\s+(contents|media_assets|events|carousel_slides|external_services)/i.test(call.query))).toBe(false);\n    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("includes newly published news on the homepage without requiring featured metadata", async () => {`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("returns a public programs response instead of the M17 skeleton", async () => {`,
  `    const searchItem = (payload.items as Array<Record<string, unknown>>)[0];\n    expect(searchItem).not.toHaveProperty("body");\n    expect(searchItem).not.toHaveProperty("content");\n    expectGeneratedAt(payload);\n    expectNoLeakage(text);\n  });\n\n  it("returns a public programs response instead of the M17 skeleton", async () => {`
);
replace(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  `    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-002" })]);\n    expectGeneratedAt(payload);`,
  `    const programItem = (payload.items as Array<Record<string, unknown>>)[0];\n    expect(programItem).not.toHaveProperty("body");\n    expect(programItem).not.toHaveProperty("content");\n    expect(payload.media).toEqual([expect.objectContaining({ id: "sample-media-002" })]);\n    expectGeneratedAt(payload);`
);

write(
  "src/test/publicApiContractReadiness.test.ts",
  `import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicContentDetailSnapshot,
  getPublicContentListPageSnapshot
} from "../features/public-content";
import { getPublicSearchIndexSnapshot } from "../features/public-search";
import { getPublicShellSnapshot } from "../features/public-shell";

const generatedAt = "2026-08-03T00:00:00.000Z";
const summaryItem = {
  id: "news-1",
  title: "Award news",
  slug: "award-news",
  type: "news",
  status: "published",
  owner: "",
  summary: "award",
  updatedAt: generatedAt,
  publishAt: generatedAt
};
const sharedMetadata = {
  siteSettings: {},
  homepageSettings: {},
  displaySettings: {},
  menu: [],
  generatedAt
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Step 4 public API contract readiness", () => {
  it("delegates a normalized public search query to the Worker", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ...sharedMetadata, query: "award", items: [summaryItem] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicSearchIndexSnapshot("  award  ")).resolves.toMatchObject({
      query: "award",
      items: [expect.objectContaining({ id: "news-1" })]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/search?q=award",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("builds the opt-in paginated content request without changing the default API", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...sharedMetadata,
        kind: "news",
        items: [summaryItem],
        media: [],
        pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicContentListPageSnapshot("news", { page: 2, pageSize: 12 })).resolves.toMatchObject({
      pagination: { page: 2, pageSize: 12, totalItems: 13, totalPages: 2 }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.test/api/public/content?kind=news&page=2&pageSize=12",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("exposes detail media while keeping the full article body on detail only", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          item: { ...summaryItem, body: "Full body" },
          media: [{ id: "media-1" }],
          generatedAt
        })
      )
    );

    await expect(getPublicContentDetailSnapshot({ slug: "award-news" })).resolves.toMatchObject({
      item: { body: "Full body" },
      media: [{ id: "media-1" }]
    });
  });

  it("falls back to the home metadata contract when an older Worker does not expose public-shell", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404))
      .mockResolvedValueOnce(
        jsonResponse({
          ...sharedMetadata,
          carouselSlides: [],
          externalServices: [],
          visitorStats: {},
          latestNews: [],
          latestAnnouncements: [],
          procurementItems: [],
          jobOpportunityItems: [],
          achievementItems: [],
          programItems: [],
          documentItems: [],
          eventItems: [],
          media: []
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPublicShellSnapshot()).resolves.toEqual(sharedMetadata);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://public-api.example.test/api/public/shell",
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://public-api.example.test/api/public/home",
      expect.objectContaining({ method: "GET" })
    );
  });
});
`
);

replace(
  "docs/architecture/current-runtime-ownership.md",
  `These readiness changes do not enable server rendering, hydration, route loaders, server-side metadata, canonical redirects, or new Public API response contracts. Those remain separate migration stages and must preserve the existing Public/Admin runtime boundaries.`,
  `Public API contract readiness now separates list/search/home summaries from full content detail. Summary reads omit article body fields, content detail returns its referenced media, content lists support optional page/pageSize metadata without changing the existing unpaginated URL behavior, and /api/public/shell exposes only site/homepage/display/menu metadata for the later shell migration. Public search queries are delegated to the Worker through q instead of requiring normal searches to download the entire content index. The frontend public-shell API falls back to the home metadata projection only when an older Worker returns 404, allowing a safe incremental rollout.\n\nThese readiness changes do not enable server rendering, hydration, route loaders, server-side metadata, canonical redirects, or the Step 5 PublicSiteShell refactor. Those remain separate migration stages and must preserve the existing Public/Admin runtime boundaries.`
);

replace(
  "cloudflare/public-api/README.md",
  `- \`/api/public/home\`\n- \`/api/public/content?kind=<news|announcements|blog>\``,
  `- \`/api/public/home\`\n- \`/api/public/shell\`\n- \`/api/public/content?kind=<news|announcements|blog>\`\n- \`/api/public/content?kind=<news|announcements|blog>&page=<n>&pageSize=<1-100>\` (optional pagination)`
);
replace(
  "cloudflare/public-api/README.md",
  `Public responses preserve the current React snapshot shapes. M17 compatibility fields remain where earlier smoke contracts used them. Public routes remain GET/OPTIONS-only and never receive credentialed wildcard CORS.`,
  `Public list, program, home, and search responses use summary content records and omit full body fields; full bodies remain on content detail, which also returns referenced media. The unpaginated content-list URL remains backward compatible, while page/pageSize is opt-in. /api/public/shell is a lightweight settings/menu contract for the SSR-readiness migration. Public routes remain GET/OPTIONS-only and never receive credentialed wildcard CORS.`
);

console.log("Step 4 Public API contract readiness patch applied.");
