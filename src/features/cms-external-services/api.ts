import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import {
  deleteExternalServiceLinkFromApi as deleteExternalServiceLinkFromAppsScript,
  saveExternalServiceLinkToApi as saveExternalServiceLinkToAppsScript
} from "../../services/googleApi";
import {
  deleteExternalServiceLinkFromCloudflare,
  saveExternalServiceLinkToCloudflare
} from "../admin-write/cloudflareApi";
export type { ExternalServiceLinkInput } from "../../services/googleApi";
import type { ExternalServiceLinkInput } from "../../services/googleApi";

export function saveExternalServiceLinkToApi(input: ExternalServiceLinkInput) {
  return getAdminWriteProvider() === "cloudflare"
    ? saveExternalServiceLinkToCloudflare(input)
    : saveExternalServiceLinkToAppsScript(input);
}

export function deleteExternalServiceLinkFromApi(id: string) {
  return getAdminWriteProvider() === "cloudflare"
    ? deleteExternalServiceLinkFromCloudflare(id)
    : deleteExternalServiceLinkFromAppsScript(id);
}
