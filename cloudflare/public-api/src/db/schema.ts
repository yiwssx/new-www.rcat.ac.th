export interface DocumentRow {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  file_name: string;
  media_id: string | null;
  published_at: string;
  status: "draft" | "published";
  sort_order: number;
  pinned: 0 | 1;
  updated_at: string;
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

export interface ContentRow {
  id: string;
  slug: string;
  title: string;
  content_type: string;
  status: "draft" | "published" | "archived";
  summary: string;
  body_json: string;
  cover_media_id: string | null;
  owner: string;
  published_at: string | null;
  sort_order: number;
  featured: 0 | 1;
  updated_at: string;
}

export interface MediaAssetRow {
  id: string;
  name: string;
  media_type: string;
  mime_type: string;
  size_bytes: number;
  drive_file_id: string | null;
  drive_url: string | null;
  public_url: string | null;
  alt_text: string;
  owner: string;
  created_at: string;
  updated_at: string;
}

export interface SiteSettingsRow {
  id: string;
  site_name: string;
  public_site_url: string;
  logo_media_id: string | null;
  contact_json: string;
  social_links_json: string;
  updated_at: string;
}

export interface HomepageSettingsRow {
  id: string;
  hero_content_id: string | null;
  intro_video_url: string | null;
  director_message_content_id: string | null;
  layout_json: string;
  updated_at: string;
}

export interface DisplaySettingsRow {
  id: string;
  locale: string;
  timezone: string;
  date_format: string;
  time_format: string;
  updated_at: string;
}

export interface MenuItemRow {
  id: string;
  parent_id: string | null;
  label: string;
  href: string;
  content_id: string | null;
  target: string;
  status: "draft" | "published";
  sort_order: number;
  updated_at: string;
}

export interface CarouselSlideRow {
  id: string;
  title: string;
  subtitle: string;
  image_media_id: string | null;
  image_url: string | null;
  href: string;
  enabled: 0 | 1;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
}

export interface ExternalServiceRow {
  id: string;
  title: string;
  description: string;
  icon_url: string | null;
  href: string;
  enabled: 0 | 1;
  sort_order: number;
  updated_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  description: string;
  location: string;
  audience: string;
  start_at: string;
  end_at: string | null;
  status: "draft" | "published" | "cancelled";
  updated_at: string;
}

export interface VisitorEventRow {
  id: string;
  session_hash: string;
  path: string;
  referrer: string | null;
  user_agent_hash: string | null;
  occurred_at: string;
}

export interface VisitorDailyStatsRow {
  stat_date: string;
  page_views: number;
  unique_visitors: number;
  updated_at: string;
}

export interface ContentViewEventRow {
  id: string;
  content_id: string;
  session_hash: string;
  occurred_at: string;
}

export interface ContentViewDailyStatsRow {
  content_id: string;
  stat_date: string;
  view_count: number;
  unique_viewers: number;
  updated_at: string;
}

export interface SyncRunRow {
  id: string;
  source: string;
  phase: string;
  status: "started" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  summary_json: string;
  error_message: string | null;
}
