import {
  recordContentViewToCloudflare,
  recordPresenceToCloudflare,
  recordSiteViewToCloudflare
} from "../public-read/cloudflareApi";
import type { SiteViewInput } from "./types";

export function recordSiteView(input: SiteViewInput) {
  return recordSiteViewToCloudflare(input);
}

export function recordContentView(input: { id?: string; slug?: string }) {
  return recordContentViewToCloudflare(input);
}

export function recordPresence(input: Pick<SiteViewInput, "visitorId" | "path">) {
  return recordPresenceToCloudflare(input);
}

export type { ContentViewResponse, SiteViewInput } from "./types";
