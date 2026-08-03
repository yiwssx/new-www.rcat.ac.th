import type {
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
