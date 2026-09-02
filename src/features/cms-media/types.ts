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

export interface MediaAssetInput {
  id?: string;
  name: string;
  type: MediaType;
  size?: string;
  owner: string;
  driveUrl?: string;
  fileId?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  fileName?: string;
  fileBase64?: string;
}

export interface FacebookThumbnailImportInput {
  sourceUrl: string;
  name: string;
  owner: string;
}

export type FacebookThumbnailProgressPhase = "requesting" | "retrying" | "received" | "persisting" | "persisted";

export interface FacebookThumbnailProgress {
  phase: FacebookThumbnailProgressPhase;
  attempt?: number;
  totalAttempts?: number;
}

export interface FacebookThumbnailImportOptions {
  onProgress?: (progress: FacebookThumbnailProgress) => void;
}
