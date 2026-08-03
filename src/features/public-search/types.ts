import type { PublicMenuItem } from "../cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "../cms-settings/types";
import type { PublicContentSummary } from "../public-content/types";

export interface PublicSearchIndexSnapshot {
  query?: string;
  items: PublicContentSummary[];
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  generatedAt: string;
}
