import type { PublicReadRequestOptions } from "../public-read/request";
import { getPublicDocumentListFromCloudflare } from "./cloudflareApi";
import type { PublicDocumentListSnapshot } from "./types";

export async function getPublicDocumentList(options: PublicReadRequestOptions = {}): Promise<PublicDocumentListSnapshot> {
  return getPublicDocumentListFromCloudflare(options);
}
