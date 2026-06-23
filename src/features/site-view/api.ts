import { getPublicApiProvider } from "../../config/publicApiProvider";
import {
  recordContentViewToCloudflare,
  recordPresenceToCloudflare,
  recordSiteViewToCloudflare
} from "../public-read/cloudflareApi";
import type { SiteViewInput } from "./types";

const warnedNoopActions = new Set<string>();

function warnPublicAnalyticsNoop(action: string) {
  if (!import.meta.env.DEV || warnedNoopActions.has(action)) {
    return;
  }

  warnedNoopActions.add(action);
  console.warn(`Public ${action} analytics is Cloudflare-only in M20 and is disabled for the current provider.`);
}

export function recordSiteView(input: SiteViewInput) {
  if (getPublicApiProvider() !== "cloudflare") {
    warnPublicAnalyticsNoop("site-view");
    return false;
  }

  return recordSiteViewToCloudflare(input);
}

export function recordContentView(input: { id?: string; slug?: string }) {
  if (getPublicApiProvider() !== "cloudflare") {
    warnPublicAnalyticsNoop("content-view");
    return Promise.reject(new Error("Public content-view analytics is Cloudflare-only in M20."));
  }

  return recordContentViewToCloudflare(input);
}

export function recordPresence(input: Pick<SiteViewInput, "visitorId" | "path">) {
  if (getPublicApiProvider() !== "cloudflare") {
    warnPublicAnalyticsNoop("presence");
    return false;
  }

  return recordPresenceToCloudflare(input);
}

export type { ContentViewResponse, SiteViewInput } from "./types";
