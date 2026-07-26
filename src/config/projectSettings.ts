import projectSettingsData from "./project-settings.json";
import type { RolePermission } from "../types";

interface ProjectSettings {
  site: {
    name: string;
    publicSiteUrl: string;
    language: string;
    locale: string;
    logoPath: string;
    logoAlt: string;
  };
  query: {
    staleTimeMs: number;
    gcTimeMs: number;
    retry: number;
    refetchOnMount: boolean;
    refetchOnReconnect: boolean;
    refetchOnWindowFocus: boolean;
  };
  storageKeys: {
    displaySettings: string;
  };
  roles: RolePermission[];
  theme: {
    palette: Record<string, string>;
    shape: {
      borderRadius: number;
    };
    typography: {
      fontFamily: string[];
    };
  };
}

export const projectSettings = projectSettingsData as ProjectSettings;

export function getCmsSiteName() {
  return import.meta.env.VITE_CMS_SITE_NAME?.trim() || projectSettings.site.name;
}

export function getPublicSiteUrl() {
  return import.meta.env.VITE_PUBLIC_SITE_URL?.trim() || projectSettings.site.publicSiteUrl;
}
