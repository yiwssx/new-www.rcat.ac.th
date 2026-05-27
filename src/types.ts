import type { CarouselSlide } from "./features/cms-carousel/types";
import type { DashboardMetric } from "./features/cms-dashboard/types";
import type { CmsDocumentItem } from "./features/cms-documents/types";
import type { CalendarEvent } from "./features/cms-events/types";
import type { ExternalServiceLink } from "./features/cms-external-services/types";
import type { MediaAsset } from "./features/cms-media/types";
import type { PublicMenuItem } from "./features/cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "./features/cms-settings/types";
import type { ContentItem } from "./features/public-content/types";
import type { PublicDocumentItem } from "./features/public-documents/types";
import type { VisitorStatsSettings } from "./features/visitor-stats/types";

export type { CarouselSlide } from "./features/cms-carousel/types";
export type { DashboardMetric } from "./features/cms-dashboard/types";
export type { CmsDocumentItem, DocumentStatus } from "./features/cms-documents/types";
export type { CalendarEvent } from "./features/cms-events/types";
export type {
  ExternalServiceIconKey,
  ExternalServiceLink,
  ExternalServiceTone
} from "./features/cms-external-services/types";
export type { IntegrationState, IntegrationStatus } from "./features/cms-integrations/types";
export type { MediaAsset, MediaType } from "./features/cms-media/types";
export type { PublicMenuItem } from "./features/cms-navigation/types";
export type {
  DisplaySettings,
  FooterDirectoryGroup,
  FooterDirectoryLink,
  HomepageCarouselSettings,
  HomepageIntroGateSettings,
  HomepageIntroVideoSettings,
  HomepageMarqueeSettings,
  HomepageSettings,
  SiteSettings
} from "./features/cms-settings/types";
export type {
  ContentItem,
  ContentStatus,
  ContentType,
  PublicContentListKind,
  PublicContentListSnapshot
} from "./features/public-content/types";
export type { PublicDocumentItem, PublicDocumentListSnapshot } from "./features/public-documents/types";
export type { PublicProgramListSnapshot } from "./features/public-programs/types";
export type { PublicSearchIndexSnapshot } from "./features/public-search/types";
export type { VisitorStatsSettings } from "./features/visitor-stats/types";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  avatarUrl?: string;
}

export interface UserAccount extends User {
  status: "active" | "disabled";
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}

export interface RolePermission {
  id: string;
  role: string;
  scope: string;
  canPublish: boolean;
  canManageUsers: boolean;
}

export interface CmsSnapshot {
  metrics: DashboardMetric[];
  content: ContentItem[];
  documents?: CmsDocumentItem[];
  media: MediaAsset[];
  events: CalendarEvent[];
  menu?: PublicMenuItem[];
  carouselSlides?: CarouselSlide[];
  externalServices?: ExternalServiceLink[];
  displaySettings?: DisplaySettings;
  siteSettings?: SiteSettings;
  homepageSettings?: HomepageSettings;
  visitorStats?: VisitorStatsSettings;
}

export interface PublicHomeSnapshot {
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  carouselSlides: CarouselSlide[];
  externalServices: ExternalServiceLink[];
  visitorStats: VisitorStatsSettings;
  latestNews: ContentItem[];
  latestAnnouncements: ContentItem[];
  procurementItems: ContentItem[];
  jobOpportunityItems: ContentItem[];
  achievementItems: ContentItem[];
  programItems: ContentItem[];
  documentItems: Array<ContentItem | PublicDocumentItem>;
  eventItems: CalendarEvent[];
  media: MediaAsset[];
  generatedAt: string;
}
