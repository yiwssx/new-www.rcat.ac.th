import type { PublicMenuItem } from "../cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "../cms-settings/types";
import type { PublicContentPagination, PublicContentSummary } from "../public-content/types";

export interface PublicSearchIndexSnapshot {
  query?: string;
  items: PublicContentSummary[];
  pagination?: PublicContentPagination;
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  generatedAt: string;
}
