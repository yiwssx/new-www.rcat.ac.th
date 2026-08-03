import type { PublicContentSummaryContract } from "./publicContent";
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
