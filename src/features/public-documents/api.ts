import { getPublicApiProvider } from "../../config/publicApiProvider";
import { getPublicDocumentList as getPublicDocumentListFromAppsScript } from "../../services/googleApi";
import { getPublicDocumentListFromCloudflare } from "./cloudflareApi";
import type { PublicDocumentListSnapshot } from "./types";

export async function getPublicDocumentList(): Promise<PublicDocumentListSnapshot> {
  if (getPublicApiProvider() === "cloudflare") {
    return getPublicDocumentListFromCloudflare();
  }

  return getPublicDocumentListFromAppsScript();
}
