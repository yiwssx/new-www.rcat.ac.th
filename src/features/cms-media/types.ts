export type MediaType = "image" | "document" | "sheet" | "video";

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  size: string;
  owner: string;
  driveUrl: string;
  fileId?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  updatedAt: string;
}
