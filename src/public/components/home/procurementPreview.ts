import type { MediaAsset, PublicContentCardItem } from "../../../types";
import { buildGoogleDriveThumbnailUrl, extractGoogleDriveFileId } from "../../../shared/media/publicImageSources";
import { isPdfMediaAsset } from "../../../shared/media/pdfMedia";
import { resolveCardThumbnail } from "../publicContentCardThumbnail";

const PROCUREMENT_THUMBNAIL_WIDTH = 320;

type ProcurementPreviewKind = "image" | "pdf" | "fallback";

export interface ProcurementPreview {
  source: MediaAsset | string | null;
  kind: ProcurementPreviewKind;
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

  return fileId ? buildGoogleDriveThumbnailUrl(fileId, PROCUREMENT_THUMBNAIL_WIDTH) : "";
}

export function resolveProcurementPreview(item: PublicContentCardItem, mediaAssets: MediaAsset[]): ProcurementPreview {
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

  return {
    source: null,
    kind: "fallback",
    label: item.title
  };
}
