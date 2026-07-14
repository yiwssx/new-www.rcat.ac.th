import type { MediaAsset, MediaAssetInput } from "./types";

const mediaBridgePath = "/api/apps-script-proxy";
const UPLOAD_CHUNK_ALIGNMENT_BYTES = 256 * 1024;
const INVALID_UPLOAD_RESPONSE_MESSAGE = "ระบบอัปโหลดสื่อได้รับการตอบกลับที่ไม่ถูกต้อง";
const PAYLOAD_TOO_LARGE_MESSAGE = "ไฟล์มีขนาดใหญ่เกินขีดจำกัดของช่องทางอัปโหลด";

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MEDIA_UPLOAD_CHUNK_BYTES = 6 * 256 * 1024;

type MediaBridgeResource = "media" | "deleteMedia" | "startMediaUpload" | "uploadMediaChunk";
type MediaBridgeEnvelope<T> = T & {
  error?: string;
  code?: string;
  statusCode?: number;
};

interface MediaUploadStartResult {
  uploadUrl: string;
  totalBytes: number;
  chunkSizeBytes: number;
}

interface MediaUploadChunkResult {
  uploadComplete: boolean;
  nextByte?: number;
  asset?: MediaAsset;
}

export interface MediaUploadChunk {
  chunkBase64: string;
  startByte: number;
  endByte: number;
}

export interface MediaBridgeStatus {
  mode: "server-proxy";
  configured: boolean;
  appsScriptUrlConfigured: boolean;
  bridgeTokenConfigured: boolean;
}

class MediaBridgeRequestError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly bridgeStatus?: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "MediaBridgeRequestError";
  }
}

function getInvalidResponseMessage(status: number) {
  return `${INVALID_UPLOAD_RESPONSE_MESSAGE} (HTTP ${status})`;
}

function getSafeBridgeError(value: unknown, status: number) {
  if (typeof value !== "string") {
    return getInvalidResponseMessage(status);
  }

  const message = value.trim();
  if (
    !message ||
    /<\/?[a-z][\s\S]*>/i.test(message) ||
    /upload_id\s*[=:]/i.test(message) ||
    /https:\/\/www\.googleapis\.com\/upload\//i.test(message) ||
    /(?:chunk|file)Base64/i.test(message) ||
    /(?:oauth|bearer|token)/i.test(message)
  ) {
    return getInvalidResponseMessage(status);
  }

  return message.slice(0, 300);
}

function normalizeBase64(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/^data:[^,]*;base64,/i, "")
    .replace(/\s+/g, "");

  const paddingLength = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const unpadded = paddingLength ? normalized.slice(0, -paddingLength) : normalized;
  const paddingIsValid =
    (paddingLength === 0 && unpadded.length % 4 === 0) ||
    (paddingLength === 1 && unpadded.length % 4 === 3) ||
    (paddingLength === 2 && unpadded.length % 4 === 2);

  if (!unpadded || !paddingIsValid || unpadded.includes("=") || !/^[A-Za-z0-9+/]+$/.test(unpadded)) {
    throw new Error("ข้อมูลไฟล์ Base64 ไม่ถูกต้อง");
  }

  return normalized;
}

export function getBase64DecodedByteLength(value: string) {
  const normalized = normalizeBase64(value);
  const paddingBytes = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return (normalized.length / 4) * 3 - paddingBytes;
}

export function splitBase64IntoUploadChunks(value: string, chunkBytes = MEDIA_UPLOAD_CHUNK_BYTES): MediaUploadChunk[] {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0 || chunkBytes % 3 !== 0) {
    throw new Error("ขนาดส่วนอัปโหลดไม่ถูกต้อง");
  }

  const normalized = normalizeBase64(value);
  const totalBytes = getBase64DecodedByteLength(normalized);
  const chunkBase64Characters = (chunkBytes / 3) * 4;
  const chunks: MediaUploadChunk[] = [];
  let startByte = 0;

  for (let offset = 0; offset < normalized.length; offset += chunkBase64Characters) {
    const chunkBase64 = normalized.slice(offset, offset + chunkBase64Characters);
    const decodedBytes = getBase64DecodedByteLength(chunkBase64);
    const endByte = startByte + decodedBytes - 1;
    const isFinalChunk = endByte + 1 === totalBytes;

    if (chunkBytes === MEDIA_UPLOAD_CHUNK_BYTES && !isFinalChunk && decodedBytes % UPLOAD_CHUNK_ALIGNMENT_BYTES !== 0) {
      throw new Error("ขนาดส่วนอัปโหลดต้องเป็นจำนวนเท่าของ 256 KiB");
    }

    chunks.push({ chunkBase64, startByte, endByte });
    startByte = endByte + 1;
  }

  return chunks;
}

async function parseMediaBridgeResponse<T>(response: Response): Promise<MediaBridgeEnvelope<T>> {
  const text = await response.text();
  const payloadTooLarge = response.status === 413 || text.includes("FUNCTION_PAYLOAD_TOO_LARGE");

  if (payloadTooLarge) {
    throw new MediaBridgeRequestError(PAYLOAD_TOO_LARGE_MESSAGE, response.status, 413, "FUNCTION_PAYLOAD_TOO_LARGE");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MediaBridgeRequestError(getInvalidResponseMessage(response.status), response.status);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MediaBridgeRequestError(getInvalidResponseMessage(response.status), response.status);
  }

  const result = parsed as MediaBridgeEnvelope<T>;
  const bridgeStatus = Number.isFinite(result.statusCode) ? Number(result.statusCode) : undefined;
  if (!response.ok || result.error || (bridgeStatus !== undefined && bridgeStatus >= 400)) {
    throw new MediaBridgeRequestError(
      getSafeBridgeError(result.error, response.status),
      response.status,
      bridgeStatus,
      typeof result.code === "string" ? result.code : undefined
    );
  }

  return result;
}

export async function checkMediaBridgeStatus(): Promise<MediaBridgeStatus> {
  const response = await fetch(mediaBridgePath, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "same-origin"
  });
  return parseMediaBridgeResponse<MediaBridgeStatus>(response);
}

async function requestMediaBridge<T>(resource: MediaBridgeResource, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(mediaBridgePath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ resource, payload }),
    cache: "no-store",
    credentials: "same-origin"
  });

  return parseMediaBridgeResponse<T>(response);
}

function requireUploadText(value: unknown, field: string) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`ข้อมูลอัปโหลดไม่ครบถ้วน (${field})`);
  }
  return text;
}

export function uploadMediaAssetToBridge(asset: MediaAsset): Promise<MediaAsset> {
  return requestMediaBridge<MediaAsset>("media", asset as unknown as Record<string, unknown>);
}

export async function saveMediaAssetToBridge(asset: MediaAssetInput): Promise<MediaAsset> {
  if (asset.fileBase64 === undefined) {
    return requestMediaBridge<MediaAsset>("media", asset as unknown as Record<string, unknown>);
  }

  const name = requireUploadText(asset.name, "name");
  const type = requireUploadText(asset.type, "type");
  const owner = requireUploadText(asset.owner, "owner");
  const fileName = requireUploadText(asset.fileName, "fileName");
  const mimeType = requireUploadText(asset.mimeType, "mimeType");
  const totalBytes = getBase64DecodedByteLength(asset.fileBase64);

  if (totalBytes < 1 || totalBytes > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(
      totalBytes > MAX_MEDIA_UPLOAD_BYTES ? "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" : "ไฟล์ไม่มีข้อมูลสำหรับอัปโหลด"
    );
  }

  const metadata = {
    ...(asset.id ? { id: asset.id } : {}),
    name,
    type,
    owner,
    fileName,
    mimeType,
    size: asset.size || ""
  };
  const started = await requestMediaBridge<MediaUploadStartResult>("startMediaUpload", {
    ...metadata,
    totalBytes
  });

  if (
    typeof started.uploadUrl !== "string" ||
    !started.uploadUrl ||
    started.totalBytes !== totalBytes ||
    started.chunkSizeBytes !== MEDIA_UPLOAD_CHUNK_BYTES
  ) {
    throw new Error(getInvalidResponseMessage(200));
  }

  const chunks = splitBase64IntoUploadChunks(asset.fileBase64);
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const isFinalChunk = index === chunks.length - 1;
    const result = await requestMediaBridge<MediaUploadChunkResult>("uploadMediaChunk", {
      ...metadata,
      totalBytes,
      uploadUrl: started.uploadUrl,
      ...chunk
    });

    if (isFinalChunk) {
      if (!result.uploadComplete || !result.asset) {
        throw new Error(getInvalidResponseMessage(200));
      }
      return result.asset;
    }

    if (result.uploadComplete !== false || result.nextByte !== chunk.endByte + 1) {
      throw new Error(getInvalidResponseMessage(200));
    }
  }

  throw new Error(getInvalidResponseMessage(200));
}

export function deleteMediaAssetFromBridge(
  asset: string | Pick<MediaAsset, "id" | "fileId" | "driveUrl" | "previewUrl" | "embedUrl">
): Promise<{ id: string; deleted: boolean }> {
  const payload = typeof asset === "string" ? { id: asset } : asset;
  const fileId = "fileId" in payload ? payload.fileId : "";

  return requestMediaBridge("deleteMedia", {
    id: payload.id,
    ...(fileId ? { fileId } : {}),
    ...(!fileId && "driveUrl" in payload && payload.driveUrl ? { driveUrl: payload.driveUrl } : {}),
    ...(!fileId && "previewUrl" in payload && payload.previewUrl ? { previewUrl: payload.previewUrl } : {}),
    ...(!fileId && "embedUrl" in payload && payload.embedUrl ? { embedUrl: payload.embedUrl } : {}),
    deleteDriveFile: true
  });
}
