import type { PublicContentItemContract } from "./publicContent";
import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMediaAssetContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicProgramListSnapshotContract {
  items: PublicContentItemContract[];
  media: PublicMediaAssetContract[];
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
