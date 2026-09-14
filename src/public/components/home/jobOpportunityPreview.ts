import type { MediaAsset, PublicContentCardItem } from "../../../types";
import { buildGoogleDriveThumbnailUrl, extractGoogleDriveFileId } from "../../../shared/media/publicImageSources";
import { isPdfMediaAsset } from "../../../shared/media/pdfMedia";
import { resolveCardThumbnail } from "../publicContentCardThumbnail";

const JOB_THUMBNAIL_WIDTH = 320;

type JobOpportunityPreviewKind = "image" | "pdf" | "fallback";

export interface JobOpportunityPreview {
  source: MediaAsset | string | null;
  kind: JobOpportunityPreviewKind;
  label: string;
}

function getAttachedMedia(item: PublicContentCardItem, mediaAssets: MediaAsset[]) {
  return (item.mediaIds ?? [])
    .map((id) => mediaAssets.find((asset) => asset.id === id))
    .filter((asset): asset is MediaAsset => Boolean(asset));
}

function getPdfThumbnailUrl(asset: MediaAsset) {
  const existingThumbnail = String(asset.thumbnailUrl || "").trim();
  if (existingThumbnail) {
    return existingThumbnail;
  }

  const fileId =
    String(asset.fileId || "").trim() ||
    extractGoogleDriveFileId(asset.driveUrl) ||
    extractGoogleDriveFileId(asset.previewUrl) ||
    extractGoogleDriveFileId(asset.embedUrl);

  return fileId ? buildGoogleDriveThumbnailUrl(fileId, JOB_THUMBNAIL_WIDTH) : "";
}

function getBodyDocumentThumbnailUrl(item: PublicContentCardItem) {
  const fileId =
    String(item.bodyDocId || "").trim() || extractGoogleDriveFileId(String(item.bodyDocUrl || "").trim());

  return fileId ? buildGoogleDriveThumbnailUrl(fileId, JOB_THUMBNAIL_WIDTH) : "";
}

export function resolveJobOpportunityPreview(
  item: PublicContentCardItem,
  mediaAssets: MediaAsset[]
): JobOpportunityPreview {
  const image = resolveCardThumbnail(item, mediaAssets);
  if (image) {
    return {
      source: image,
      kind: "image",
      label: image.name || item.title
    };
  }

  const pdf = getAttachedMedia(item, mediaAssets).find(isPdfMediaAsset);
  if (pdf) {
    return {
      source: getPdfThumbnailUrl(pdf) || null,
      kind: "pdf",
      label: pdf.name || item.title
    };
  }

  const bodyDocumentThumbnail = getBodyDocumentThumbnailUrl(item);
  if (bodyDocumentThumbnail) {
    return {
      source: bodyDocumentThumbnail,
      kind: "pdf",
      label: item.title
    };
  }

  return {
    source: null,
    kind: "fallback",
    label: item.title
  };
}
