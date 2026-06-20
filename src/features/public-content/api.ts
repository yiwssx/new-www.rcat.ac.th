import { getPublicApiProvider } from "../../config/publicApiProvider";
import {
  getContentDetail as getContentDetailFromAppsScript,
  getPublicContentListSnapshot as getPublicContentListSnapshotFromAppsScript
} from "../../services/googleApi";
import {
  getContentDetailFromCloudflare,
  getPublicContentListSnapshotFromCloudflare
} from "../public-read/cloudflareApi";
import type { PublicContentListKind } from "./types";

export function getPublicContentListSnapshot(kind: PublicContentListKind) {
  return getPublicApiProvider() === "cloudflare"
    ? getPublicContentListSnapshotFromCloudflare(kind)
    : getPublicContentListSnapshotFromAppsScript(kind);
}

export function getContentDetail(input: { id?: string; slug?: string }) {
  return getPublicApiProvider() === "cloudflare"
    ? getContentDetailFromCloudflare(input)
    : getContentDetailFromAppsScript(input);
}
