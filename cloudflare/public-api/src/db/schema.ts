export interface DocumentRow {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  file_name: string;
  media_id: string;
  published_at: string;
  status: "draft" | "published";
  sort_order: number;
  pinned: 0 | 1;
  updated_at: string;
  created_at?: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  revision?: number;
}

export const DOCUMENT_ROW_COLUMNS = [
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
] as const satisfies readonly (keyof DocumentRow)[];

export const DOCUMENT_ADMIN_ROW_COLUMNS = [
  ...DOCUMENT_ROW_COLUMNS,
  "created_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof DocumentRow)[];

export interface ContentRow {
  id: string;
  slug: string;
  type: string;
  status: string;
  owner?: string;
  title: string;
  summary: string;
  body_snapshot: string;
  category: string;
  tags_json: string;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  featured: 0 | 1;
  reading_minutes: number;
  template: string;
  body_doc_id: string;
  body_doc_url: string;
  featured_media_id: string;
  media_ids_json: string;
  view_count: number;
  last_viewed_at: string;
  updated_at: string;
  publish_at: string;
  created_at?: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  revision?: number;
}

export const CONTENT_ROW_COLUMNS = [
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
] as const satisfies readonly (keyof ContentRow)[];

export const CONTENT_ADMIN_ROW_COLUMNS = [
  ...CONTENT_ROW_COLUMNS,
  "owner",
  "created_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof ContentRow)[];

export interface PublicHomeSectionRow {
  id: string;
  section_key: string;
  title: string;
  summary: string;
  href: string;
  sort_order: number;
  enabled: 0 | 1;
  updated_at: string;
  created_at?: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  revision?: number;
}

export const PUBLIC_HOME_SECTION_ROW_COLUMNS = [
  "id",
  "section_key",
  "title",
  "summary",
  "href",
  "sort_order",
  "enabled",
  "updated_at"
] as const satisfies readonly (keyof PublicHomeSectionRow)[];

export const PUBLIC_HOME_SECTION_ADMIN_ROW_COLUMNS = [
  ...PUBLIC_HOME_SECTION_ROW_COLUMNS,
  "created_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof PublicHomeSectionRow)[];

export interface MediaAssetRow {
  id: string;
  name: string;
  type: string;
  size: string;
  owner: string;
  drive_url: string;
  file_id: string;
  mime_type: string;
  preview_url: string;
  embed_url: string;
  thumbnail_url: string;
  updated_at: string;
}

export const MEDIA_ASSET_ROW_COLUMNS = [
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
] as const satisfies readonly (keyof MediaAssetRow)[];

export interface SiteSettingsRow {
  id: string;
  settings_json: string;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const SITE_SETTINGS_ROW_COLUMNS = [
  "id",
  "settings_json",
  "updated_at"
] as const satisfies readonly (keyof SiteSettingsRow)[];

export const SITE_SETTINGS_ADMIN_ROW_COLUMNS = [
  ...SITE_SETTINGS_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof SiteSettingsRow)[];

export interface HomepageSettingsRow {
  id: string;
  settings_json: string;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const HOMEPAGE_SETTINGS_ROW_COLUMNS = [
  "id",
  "settings_json",
  "updated_at"
] as const satisfies readonly (keyof HomepageSettingsRow)[];

export const HOMEPAGE_SETTINGS_ADMIN_ROW_COLUMNS = [
  ...HOMEPAGE_SETTINGS_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof HomepageSettingsRow)[];

export interface DisplaySettingsRow {
  id: string;
  settings_json: string;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const DISPLAY_SETTINGS_ROW_COLUMNS = [
  "id",
  "settings_json",
  "updated_at"
] as const satisfies readonly (keyof DisplaySettingsRow)[];

export const DISPLAY_SETTINGS_ADMIN_ROW_COLUMNS = [
  ...DISPLAY_SETTINGS_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof DisplaySettingsRow)[];

export interface MenuItemRow {
  id: string;
  parent_id: string;
  label: string;
  href: string;
  enabled: 0 | 1;
  sort_order: number;
  children_json: string;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const MENU_ITEM_ROW_COLUMNS = [
  "id",
  "parent_id",
  "label",
  "href",
  "enabled",
  "sort_order",
  "children_json",
  "updated_at"
] as const satisfies readonly (keyof MenuItemRow)[];

export const MENU_ITEM_ADMIN_ROW_COLUMNS = [
  ...MENU_ITEM_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof MenuItemRow)[];

export interface CarouselSlideRow {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  image_url: string;
  image_alt: string;
  button_label: string;
  href: string;
  enabled: 0 | 1;
  sort_order: number;
  start_at: string;
  end_at: string;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const CAROUSEL_SLIDE_ROW_COLUMNS = [
  "id",
  "title",
  "subtitle",
  "chip",
  "image_url",
  "image_alt",
  "button_label",
  "href",
  "enabled",
  "sort_order",
  "start_at",
  "end_at",
  "updated_at"
] as const satisfies readonly (keyof CarouselSlideRow)[];

export const CAROUSEL_SLIDE_ADMIN_ROW_COLUMNS = [
  ...CAROUSEL_SLIDE_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof CarouselSlideRow)[];

export interface ExternalServiceRow {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: string;
  icon_key: string;
  enabled: 0 | 1;
  sort_order: number;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const EXTERNAL_SERVICE_ROW_COLUMNS = [
  "id",
  "title",
  "description",
  "href",
  "tone",
  "icon_key",
  "enabled",
  "sort_order",
  "updated_at"
] as const satisfies readonly (keyof ExternalServiceRow)[];

export const EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS = [
  ...EXTERNAL_SERVICE_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof ExternalServiceRow)[];

export interface EventRow {
  id: string;
  title: string;
  date: string;
  end_date: string;
  audience: string;
  status: string;
  location: string;
  description: string;
  category: string;
  visibility: string;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const EVENT_ROW_COLUMNS = [
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
] as const satisfies readonly (keyof EventRow)[];

export const EVENT_ADMIN_ROW_COLUMNS = [
  ...EVENT_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof EventRow)[];

export interface VisitorEventRow {
  id: string;
  visitor_id: string;
  path: string;
  referrer_origin: string;
  page_title: string;
  created_at: string;
}

export const VISITOR_EVENT_ROW_COLUMNS = [
  "id",
  "visitor_id",
  "path",
  "referrer_origin",
  "page_title",
  "created_at"
] as const satisfies readonly (keyof VisitorEventRow)[];

export interface VisitorDailyStatsRow {
  day: string;
  total_views: number;
  unique_visitors: number;
  online_users: number;
  updated_at: string;
  created_at?: string;
  updated_by?: string;
  revision?: number;
}

export const VISITOR_DAILY_STATS_ROW_COLUMNS = [
  "day",
  "total_views",
  "unique_visitors",
  "online_users",
  "updated_at"
] as const satisfies readonly (keyof VisitorDailyStatsRow)[];

export const VISITOR_DAILY_STATS_ADMIN_ROW_COLUMNS = [
  ...VISITOR_DAILY_STATS_ROW_COLUMNS,
  "created_at",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof VisitorDailyStatsRow)[];

export interface AdminAuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  created_at: string;
  metadata_json: string;
}

export const ADMIN_AUDIT_LOG_ROW_COLUMNS = [
  "id",
  "entity_type",
  "entity_id",
  "action",
  "actor",
  "created_at",
  "metadata_json"
] as const satisfies readonly (keyof AdminAuditLogRow)[];

export interface ContentViewEventRow {
  id: string;
  content_id: string;
  slug: string;
  created_at: string;
}

export const CONTENT_VIEW_EVENT_ROW_COLUMNS = [
  "id",
  "content_id",
  "slug",
  "created_at"
] as const satisfies readonly (keyof ContentViewEventRow)[];

export interface ContentViewDailyStatsRow {
  day: string;
  content_id: string;
  slug: string;
  view_count: number;
  updated_at: string;
}

export const CONTENT_VIEW_DAILY_STATS_ROW_COLUMNS = [
  "day",
  "content_id",
  "slug",
  "view_count",
  "updated_at"
] as const satisfies readonly (keyof ContentViewDailyStatsRow)[];

export interface SyncRunRow {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string;
  records_read: number;
  records_written: number;
  error: string;
  metadata_json: string;
}

export const SYNC_RUN_ROW_COLUMNS = [
  "id",
  "source",
  "status",
  "started_at",
  "finished_at",
  "records_read",
  "records_written",
  "error",
  "metadata_json"
] as const satisfies readonly (keyof SyncRunRow)[];
