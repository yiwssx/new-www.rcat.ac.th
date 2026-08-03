import type { PublicReadRequestOptions } from "../public-read/request";
import { getPublicEventListFromCloudflare } from "./cloudflareApi";
import type { PublicEventListSnapshot } from "./types";

export async function getPublicEventList(options: PublicReadRequestOptions = {}): Promise<PublicEventListSnapshot> {
  return getPublicEventListFromCloudflare(options);
}
