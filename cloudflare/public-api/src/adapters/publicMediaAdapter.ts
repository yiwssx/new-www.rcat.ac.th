import type { PublicMediaAssetContract } from "../contracts/publicMetadata";
import type { MediaAssetRow } from "../db/schema";

export function mapMediaAssetRowToPublicMediaAsset(row: MediaAssetRow): PublicMediaAssetContract {
  return {
    id: row.id || "",
    name: row.name || "",
    type: row.type || "document",
    size: row.size || "",
    owner: row.owner || "",
    driveUrl: row.drive_url || "",
    ...(row.file_id
      ? {
          fileId: row.file_id
        }
      : {}),
    ...(row.mime_type
      ? {
          mimeType: row.mime_type
        }
      : {}),
    ...(row.thumbnail_url
      ? {
          thumbnailUrl: row.thumbnail_url
        }
      : {}),
    ...(row.preview_url
      ? {
          previewUrl: row.preview_url
        }
      : {}),
    ...(row.embed_url
      ? {
          embedUrl: row.embed_url
        }
      : {}),
    updatedAt: row.updated_at || ""
  };
}
