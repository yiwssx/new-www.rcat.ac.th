import type { PublicContentPaginationContract, PublicContentSummaryContract } from "./publicContent";
import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicSearchSnapshotContract {
  query: string;
  items: PublicContentSummaryContract[];
  pagination?: PublicContentPaginationContract;
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
