import type { PublicContentItemContract } from "./publicContent";
import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicSearchSnapshotContract {
  query: string;
  items: PublicContentItemContract[];
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
