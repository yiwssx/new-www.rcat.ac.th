import {
  deleteExternalServiceLinkFromCloudflare,
  saveExternalServiceLinkToCloudflare
} from "../admin-write/cloudflareApi";
import type { ExternalServiceLinkInput } from "./types";
export type { ExternalServiceLinkInput } from "./types";

export function saveExternalServiceLinkToApi(input: ExternalServiceLinkInput) {
  return saveExternalServiceLinkToCloudflare(input);
}

export function deleteExternalServiceLinkFromApi(id: string) {
  return deleteExternalServiceLinkFromCloudflare(id);
}
