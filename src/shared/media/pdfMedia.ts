import type { MediaAsset } from "../../types";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrlCore";

export function isPdfMediaAsset(asset: MediaAsset | null | undefined) {
  const mimeType = String(asset?.mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const fileName = String(asset?.name || "")
    .trim()
    .toLowerCase();

  // Preserve filename detection so legacy CMS rows without MIME metadata remain PDF-compatible.
  return mimeType === "application/pdf" || fileName.endsWith(".pdf");
}

export function getPdfViewerUrl(asset: MediaAsset | null | undefined) {
  if (!isPdfMediaAsset(asset)) {
    return "";
  }

  for (const candidate of [asset?.embedUrl, asset?.previewUrl]) {
    const safeUrl = normalizeSafeResourceUrl(candidate);

    if (safeUrl) {
      return safeUrl;
    }
  }

  return "";
}

export function getPdfOpenUrl(asset: MediaAsset | null | undefined) {
  if (!isPdfMediaAsset(asset)) {
    return "#";
  }

  for (const candidate of [asset?.driveUrl, asset?.previewUrl, asset?.embedUrl]) {
    const safeUrl = normalizeSafeHref(candidate || "");

    if (safeUrl !== "#") {
      return safeUrl;
    }
  }

  return "#";
}
