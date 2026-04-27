import projectSettingsData from "./project-settings.json";
import type { RolePermission, UserAccount } from "../types";

interface ProjectSettings {
  site: {
    name: string;
    publicSiteUrl: string;
    logoPath: string;
    logoAlt: string;
  };
  api: {
    googleAppsScriptUrl: string;
    googleAppsScriptUrlEnv: string;
    resources: {
      snapshot: string;
      health: string;
      authLogin: string;
      content: string;
      contentDetail: string;
      deleteContent: string;
      media: string;
      deleteMedia: string;
      publish: string;
      menu: string;
      event: string;
      deleteEvent: string;
      displaySettings: string;
      users: string;
      deleteUser: string;
      resetUsers: string;
      languageSource: string;
    };
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
    session: string;
    users: string;
    displaySettings: string;
    publicLanguageSource: string;
  };
  auth: {
    sessionHours: number;
    loginPrefill: {
      email: string;
      password: string;
    };
    bootstrapUsers: UserAccount[];
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

export function getGoogleAppsScriptUrl() {
  return import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL?.trim() || projectSettings.api.googleAppsScriptUrl.trim();
}

export function getPublicSiteUrl() {
  return import.meta.env.VITE_PUBLIC_SITE_URL?.trim() || projectSettings.site.publicSiteUrl;
}
