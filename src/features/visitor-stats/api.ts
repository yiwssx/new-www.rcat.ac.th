import { getVisitorStatsFromCloudflare } from "../public-read/cloudflareApi";
import type { PublicReadRequestOptions } from "../public-read/request";
import type { VisitorStatsSettings } from "./types";

export function getLiveVisitorStats(options: PublicReadRequestOptions = {}): Promise<VisitorStatsSettings> {
  return getVisitorStatsFromCloudflare(options);
}
