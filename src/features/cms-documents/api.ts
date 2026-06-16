import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import { deleteDocumentFromCloudflare, saveDocumentToCloudflare } from "../admin-write/cloudflareApi";
import {
  deleteDocumentFromApi as deleteDocumentFromAppsScript,
  saveDocumentToApi as saveDocumentToAppsScript
} from "../../services/googleApi";
export type { DocumentItemInput } from "../../services/googleApi";
import type { DocumentItemInput } from "../../services/googleApi";
import type { CmsDocumentItem } from "./types";

export async function saveDocumentToApi(document: DocumentItemInput): Promise<CmsDocumentItem> {
  return getAdminWriteProvider() === "cloudflare"
    ? saveDocumentToCloudflare(document)
    : saveDocumentToAppsScript(document);
}

export async function deleteDocumentFromApi(id: string): Promise<{ id: string; deleted: boolean }> {
  return getAdminWriteProvider() === "cloudflare" ? deleteDocumentFromCloudflare(id) : deleteDocumentFromAppsScript(id);
}
