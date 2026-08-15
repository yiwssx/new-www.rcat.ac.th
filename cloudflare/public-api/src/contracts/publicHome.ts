import type { PublicContentCardContract } from "./publicContent";
import type { PublicDocumentItemContract } from "./publicDocuments";
import type {
  PublicCarouselSlideContract,
  PublicEventContract,
  PublicExternalServiceContract,
  PublicMediaAssetContract
} from "./publicMetadata";
import type { PublicVisitorStatsSnapshotContract } from "./publicVisitorStats";

export interface PublicHomeSnapshotContract {
  carouselSlides: PublicCarouselSlideContract[];
  externalServices: PublicExternalServiceContract[];
  visitorStats: PublicVisitorStatsSnapshotContract;
  latestNews: PublicContentCardContract[];
  latestAnnouncements: PublicContentCardContract[];
  procurementItems: PublicContentCardContract[];
  jobOpportunityItems: PublicContentCardContract[];
  achievementItems: PublicContentCardContract[];
  programItems: PublicContentCardContract[];
  documentItems: PublicDocumentItemContract[];
  eventItems: PublicEventContract[];
  media: PublicMediaAssetContract[];
  generatedAt: string;
}
