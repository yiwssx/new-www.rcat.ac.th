import { projectSettings } from "../config/projectSettings";

export function isProductionBuild() {
  return Boolean(import.meta.env.PROD) || import.meta.env.MODE === "production";
}

export function assertLocalAuthFallbackAllowed() {
  if (isProductionBuild()) {
    throw new Error(`Missing ${projectSettings.api.googleAppsScriptUrlEnv}; production auth requires Apps Script.`);
  }
}
