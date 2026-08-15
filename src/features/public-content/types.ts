import type { MediaAsset } from "../cms-media/types";
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

export type PublicContentCardItem = Pick<
  ContentItem,
  | "id"
  | "title"
  | "slug"
  | "type"
  | "status"
  | "owner"
  | "summary"
  | "category"
  | "tags"
  | "canonicalUrl"
  | "featured"
  | "readingMinutes"
  | "template"
  | "featuredMediaId"
  | "publishAt"
> &
  Pick<Partial<ContentItem>, "updatedAt">;

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
  pageItemsPagination?: PublicContentPagination;
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
  relatedItems?: PublicContentCardItem[];
  generatedAt: string;
}
