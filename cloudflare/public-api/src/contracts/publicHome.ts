import type { PublicContentItemContract } from "./publicContent";
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
  latestNews: PublicContentItemContract[];
  latestAnnouncements: PublicContentItemContract[];
  procurementItems: PublicContentItemContract[];
  jobOpportunityItems: PublicContentItemContract[];
  achievementItems: PublicContentItemContract[];
  programItems: PublicContentItemContract[];
  documentItems: PublicDocumentItemContract[];
  eventItems: PublicEventContract[];
  media: PublicMediaAssetContract[];
  sections: PublicHomeSectionContract[];
  featuredContent: PublicContentItemContract[];
  featuredDocuments: PublicDocumentItemContract[];
  programs: PublicContentItemContract[];
  generatedAt: string;
}
