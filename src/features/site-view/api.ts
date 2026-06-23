import { getPublicApiProvider } from "../../config/publicApiProvider";
import {
  recordContentView as recordContentViewWithAppsScript,
  recordSiteView as recordSiteViewWithAppsScript,
  type SiteViewInput
} from "../../services/googleApi";
import {
  recordContentViewToCloudflare,
  recordPresenceToCloudflare,
  recordSiteViewToCloudflare
} from "../public-read/cloudflareApi";

export function recordSiteView(input: SiteViewInput) {
  return getPublicApiProvider() === "cloudflare"
    ? recordSiteViewToCloudflare(input)
    : recordSiteViewWithAppsScript(input);
}

export function recordContentView(input: { id?: string; slug?: string }) {
  return getPublicApiProvider() === "cloudflare"
    ? recordContentViewToCloudflare(input)
    : recordContentViewWithAppsScript(input);
}

export function recordPresence(input: Pick<SiteViewInput, "visitorId" | "path">) {
  return getPublicApiProvider() === "cloudflare" ? recordPresenceToCloudflare(input) : false;
}

export type { SiteViewInput } from "../../services/googleApi";
