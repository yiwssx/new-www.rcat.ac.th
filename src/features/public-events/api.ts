import { getPublicEventListFromCloudflare } from "./cloudflareApi";
import type { PublicEventListSnapshot } from "./types";

export async function getPublicEventList(): Promise<PublicEventListSnapshot> {
  return getPublicEventListFromCloudflare();
}
