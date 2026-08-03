import type { PublicContentSummaryContract } from "./publicContent";
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
