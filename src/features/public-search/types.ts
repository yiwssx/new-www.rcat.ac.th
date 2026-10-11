import type { PublicMenuItem } from "../cms-navigation/types";
import type { DisplaySettings, HomepageSettings, SiteSettings } from "../cms-settings/types";
import type { PublicContentPagination, PublicContentSummary } from "../public-content/types";
import type { PublicOrganizationUnit } from "../public-organization/api";

export interface PublicSearchIndexSnapshot {
  query?: string;
  items: PublicContentSummary[];
  organizationItems?: PublicOrganizationUnit[];
  pagination?: PublicContentPagination;
  siteSettings: SiteSettings;
  homepageSettings: HomepageSettings;
  displaySettings?: DisplaySettings;
  menu: PublicMenuItem[];
  generatedAt: string;
}
