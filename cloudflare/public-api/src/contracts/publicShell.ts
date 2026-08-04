import type {
  PublicDisplaySettingsContract,
  PublicHomepageSettingsContract,
  PublicMenuItemContract,
  PublicSiteSettingsContract
} from "./publicMetadata";

export interface PublicShellSnapshotContract {
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  generatedAt: string;
}
