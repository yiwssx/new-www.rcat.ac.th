import { getVisitorStatsFromCloudflare } from "../public-read/cloudflareApi";
import type { VisitorStatsSettings } from "./types";

export function getLiveVisitorStats(): Promise<VisitorStatsSettings> {
  return getVisitorStatsFromCloudflare();
}
