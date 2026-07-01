import { getPublicDocumentListFromCloudflare } from "./cloudflareApi";
import type { PublicDocumentListSnapshot } from "./types";

export async function getPublicDocumentList(): Promise<PublicDocumentListSnapshot> {
  return getPublicDocumentListFromCloudflare();
}
