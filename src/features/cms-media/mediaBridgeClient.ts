import type { MediaAsset, MediaAssetInput, MediaType } from "./types";

const mediaBridgePath = "/api/apps-script-proxy";
const UPLOAD_CHUNK_ALIGNMENT_BYTES = 256 * 1024;
const INVALID_UPLOAD_RESPONSE_MESSAGE = "ระบบอัปโหลดสื่อได้รับการตอบกลับที่ไม่ถูกต้อง";
const PAYLOAD_TOO_LARGE_MESSAGE = "ไฟล์มีขนาดใหญ่เกินขีดจำกัดของช่องทางอัปโหลด";
const SESSION_RESTART_FAILED_MESSAGE = "เซสชันอัปโหลดหมดอายุและไม่สามารถเริ่มใหม่ได้ กรุณาลองอัปโหลดไฟล์อีกครั้ง";
const RETRY_LIMIT_MESSAGE = "ไม่สามารถอัปโหลดไฟล์ต่อได้หลังจากลองใหม่ กรุณาลองอัปโหลดไฟล์อีกครั้ง";
const NO_PROGRESS_MESSAGE = "การอัปโหลดไม่คืบหน้า กรุณาลองอัปโหลดไฟล์อีกครั้ง";
const MEDIA_UPLOAD_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MEDIA_UPLOAD_TYPES: MediaType[] = ["image", "document", "sheet", "video"];

export const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MEDIA_UPLOAD_CHUNK_BYTES = 6 * 256 * 1024;

const MAX_CHUNK_RETRIES = 2;
const MAX_STATUS_RETRIES = 2;
const MAX_SESSION_RESTARTS = 1;
const MAX_NO_PROGRESS_CYCLES = 3;

type MediaBridgeResource = "media" | "deleteMedia" | "startMediaUpload" | "uploadMediaChunk" | "queryMediaUploadStatus";

type MediaBridgeEnvelope<T> = T & {
  error?: string;
  code?: string;
  statusCode?: number;
};

type MediaUploadCompleteResult = {
  uploadComplete: true;
  asset: MediaAsset;
};

type MediaUploadIncompleteResult = {
  uploadComplete: false;
  nextByte: number;
};

type MediaUploadStartResult =
  | MediaUploadCompleteResult
  | (MediaUploadIncompleteResult & {
      uploadUrl: string;
      totalBytes: number;
      chunkSizeBytes: number;
    });

type MediaUploadChunkResult = MediaUploadCompleteResult | MediaUploadIncompleteResult;
type MediaUploadStatusResult = MediaUploadCompleteResult | MediaUploadIncompleteResult;

interface MediaUploadRecoveryOptions {
  createUploadKey?: () => string;
  delay?: (milliseconds: number) => Promise<void>;
  random?: () => number;
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

export class MediaBridgeRequestError extends Error {
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
    /https:\/\/www\.googleapis\.com\/(?:upload|drive)\//i.test(message) ||
    /(?:chunk|file)Base64/i.test(message) ||
    /(?:uploadKey|rcatUploadKey)/i.test(message) ||
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

function getNormalizedBase64DecodedByteLength(normalized: string) {
  const paddingBytes = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return (normalized.length / 4) * 3 - paddingBytes;
}

export function getBase64DecodedByteLength(value: string) {
  return getNormalizedBase64DecodedByteLength(normalizeBase64(value));
}

function sliceNormalizedBase64ByByteRange(
  normalized: string,
  totalBytes: number,
  startByte: number,
  endByteExclusive: number
) {
  if (
    !Number.isSafeInteger(startByte) ||
    !Number.isSafeInteger(endByteExclusive) ||
    startByte < 0 ||
    endByteExclusive < startByte ||
    endByteExclusive > totalBytes
  ) {
    throw new Error("ช่วงข้อมูลไฟล์สำหรับอัปโหลดไม่ถูกต้อง");
  }

  if (startByte === endByteExclusive) {
    return "";
  }

  const groupStartByte = Math.floor(startByte / 3) * 3;
  const groupEndByte = Math.min(totalBytes, Math.ceil(endByteExclusive / 3) * 3);
  const base64Start = (groupStartByte / 3) * 4;
  const base64End = Math.ceil(groupEndByte / 3) * 4;
  const decodedSegment = atob(normalized.slice(base64Start, base64End));
  const leadingBytes = startByte - groupStartByte;
  const selectedLength = endByteExclusive - startByte;

  return btoa(decodedSegment.slice(leadingBytes, leadingBytes + selectedLength));
}

export function sliceBase64ByByteRange(value: string, startByte: number, endByteExclusive: number) {
  const normalized = normalizeBase64(value);
  return sliceNormalizedBase64ByByteRange(
    normalized,
    getNormalizedBase64DecodedByteLength(normalized),
    startByte,
    endByteExclusive
  );
}

export function splitBase64IntoUploadChunks(value: string, chunkBytes = MEDIA_UPLOAD_CHUNK_BYTES): MediaUploadChunk[] {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0 || chunkBytes % 3 !== 0) {
    throw new Error("ขนาดส่วนอัปโหลดไม่ถูกต้อง");
  }

  const normalized = normalizeBase64(value);
  const totalBytes = getNormalizedBase64DecodedByteLength(normalized);
  const chunks: MediaUploadChunk[] = [];

  for (let startByte = 0; startByte < totalBytes; startByte += chunkBytes) {
    const endByteExclusive = Math.min(totalBytes, startByte + chunkBytes);
    const decodedBytes = endByteExclusive - startByte;
    const isFinalChunk = endByteExclusive === totalBytes;

    if (chunkBytes === MEDIA_UPLOAD_CHUNK_BYTES && !isFinalChunk && decodedBytes % UPLOAD_CHUNK_ALIGNMENT_BYTES !== 0) {
      throw new Error("ขนาดส่วนอัปโหลดต้องเป็นจำนวนเท่าของ 256 KiB");
    }

    chunks.push({
      chunkBase64: sliceNormalizedBase64ByByteRange(normalized, totalBytes, startByte, endByteExclusive),
      startByte,
      endByte: endByteExclusive - 1
    });
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

function createMediaUploadKey() {
  const runtimeCrypto = globalThis.crypto;
  if (runtimeCrypto && typeof runtimeCrypto.randomUUID === "function") {
    return runtimeCrypto.randomUUID();
  }

  const randomParts: string[] = [];
  if (runtimeCrypto && typeof runtimeCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    runtimeCrypto.getRandomValues(bytes);
    for (const byte of bytes) {
      randomParts.push(byte.toString(16).padStart(2, "0"));
    }
  } else {
    randomParts.push(Date.now().toString(36), Math.random().toString(36).slice(2), Math.random().toString(36).slice(2));
  }

  return `upload_${randomParts.join("")}`.slice(0, 128).padEnd(16, "0");
}

function validateMediaUploadKey(value: string) {
  if (!MEDIA_UPLOAD_KEY_PATTERN.test(value)) {
    throw new Error("ไม่สามารถสร้างรหัสอ้างอิงการอัปโหลดที่ปลอดภัยได้");
  }
  return value;
}

function normalizeReturnedMediaAsset(value: unknown): MediaAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(getInvalidResponseMessage(200));
  }

  const candidate = value as Record<string, unknown>;
  const type = String(candidate.type || "") as MediaType;
  const requiredStrings = ["id", "name", "size", "owner", "driveUrl", "updatedAt"] as const;
  if (!MEDIA_UPLOAD_TYPES.includes(type) || requiredStrings.some((field) => typeof candidate[field] !== "string")) {
    throw new Error(getInvalidResponseMessage(200));
  }

  const optionalFields = ["fileId", "mimeType", "thumbnailUrl", "previewUrl", "embedUrl"] as const;
  const asset: MediaAsset = {
    id: candidate.id as string,
    name: candidate.name as string,
    type,
    size: candidate.size as string,
    owner: candidate.owner as string,
    driveUrl: candidate.driveUrl as string,
    updatedAt: candidate.updatedAt as string
  };

  for (const field of optionalFields) {
    if (typeof candidate[field] === "string") {
      asset[field] = candidate[field] as string;
    }
  }

  return asset;
}

function validateNextByte(value: unknown, totalBytes: number) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > totalBytes) {
    throw new Error(getInvalidResponseMessage(200));
  }
  return Number(value);
}

function validateUploadProgressResult(value: unknown, totalBytes: number): MediaUploadChunkResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(getInvalidResponseMessage(200));
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.uploadComplete === true) {
    return { uploadComplete: true, asset: normalizeReturnedMediaAsset(candidate.asset) };
  }
  if (candidate.uploadComplete === false) {
    return { uploadComplete: false, nextByte: validateNextByte(candidate.nextByte, totalBytes) };
  }
  throw new Error(getInvalidResponseMessage(200));
}

function validateUploadStartResult(value: unknown, totalBytes: number): MediaUploadStartResult {
  const progress = validateUploadProgressResult(value, totalBytes);
  if (progress.uploadComplete) {
    return progress;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.uploadUrl !== "string" ||
    !candidate.uploadUrl ||
    candidate.totalBytes !== totalBytes ||
    candidate.chunkSizeBytes !== MEDIA_UPLOAD_CHUNK_BYTES
  ) {
    throw new Error(getInvalidResponseMessage(200));
  }

  return {
    uploadComplete: false,
    uploadUrl: candidate.uploadUrl,
    totalBytes,
    chunkSizeBytes: MEDIA_UPLOAD_CHUNK_BYTES,
    nextByte: progress.nextByte
  };
}

function isRetryableStatus(status: number | undefined) {
  return status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500 && status <= 599);
}

export function isTransientMediaBridgeError(error: unknown) {
  if (error instanceof TypeError) {
    return true;
  }
  if (!(error instanceof MediaBridgeRequestError)) {
    return false;
  }
  return (
    error.code === "DRIVE_UPLOAD_TRANSIENT" ||
    isRetryableStatus(error.httpStatus) ||
    isRetryableStatus(error.bridgeStatus)
  );
}

export function isExpiredMediaUploadSessionError(error: unknown) {
  return (
    error instanceof MediaBridgeRequestError &&
    (error.code === "MEDIA_UPLOAD_SESSION_EXPIRED" || error.httpStatus === 410 || error.bridgeStatus === 410)
  );
}

function defaultRetryDelay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

async function waitBeforeRetry(retryNumber: number, options: MediaUploadRecoveryOptions) {
  const bases = [250, 750];
  const base = bases[Math.min(Math.max(retryNumber - 1, 0), bases.length - 1)];
  const random = options.random?.() ?? Math.random();
  const jittered = Math.round(base * (0.8 + Math.min(Math.max(random, 0), 1) * 0.4));
  await (options.delay ?? defaultRetryDelay)(jittered);
}

async function requestStartWithRetries(
  payload: Record<string, unknown>,
  totalBytes: number,
  options: MediaUploadRecoveryOptions
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await requestMediaBridge<unknown>("startMediaUpload", payload);
      return validateUploadStartResult(result, totalBytes);
    } catch (error) {
      if (!isTransientMediaBridgeError(error) || attempt >= MAX_CHUNK_RETRIES) {
        throw error;
      }
      await waitBeforeRetry(attempt + 1, options);
    }
  }
}

async function requestStatusWithRetries(
  payload: Record<string, unknown>,
  totalBytes: number,
  options: MediaUploadRecoveryOptions
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await requestMediaBridge<unknown>("queryMediaUploadStatus", payload);
      return validateUploadProgressResult(result, totalBytes) as MediaUploadStatusResult;
    } catch (error) {
      if (
        isExpiredMediaUploadSessionError(error) ||
        !isTransientMediaBridgeError(error) ||
        attempt >= MAX_STATUS_RETRIES
      ) {
        throw error;
      }
      await waitBeforeRetry(attempt + 1, options);
    }
  }
}

export function uploadMediaAssetToBridge(asset: MediaAsset): Promise<MediaAsset> {
  return requestMediaBridge<MediaAsset>("media", asset as unknown as Record<string, unknown>);
}

export async function saveMediaAssetToBridge(
  asset: MediaAssetInput,
  recoveryOptions: MediaUploadRecoveryOptions = {}
): Promise<MediaAsset> {
  if (asset.fileBase64 === undefined) {
    return requestMediaBridge<MediaAsset>("media", asset as unknown as Record<string, unknown>);
  }

  const name = requireUploadText(asset.name, "name");
  const type = requireUploadText(asset.type, "type");
  const owner = requireUploadText(asset.owner, "owner");
  const fileName = requireUploadText(asset.fileName, "fileName");
  const mimeType = requireUploadText(asset.mimeType, "mimeType");
  const normalizedBase64 = normalizeBase64(asset.fileBase64);
  const totalBytes = getNormalizedBase64DecodedByteLength(normalizedBase64);

  if (totalBytes < 1 || totalBytes > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(
      totalBytes > MAX_MEDIA_UPLOAD_BYTES ? "ไฟล์ต้องมีขนาดไม่เกิน 10 MB" : "ไฟล์ไม่มีข้อมูลสำหรับอัปโหลด"
    );
  }

  const uploadKey = validateMediaUploadKey((recoveryOptions.createUploadKey ?? createMediaUploadKey)());
  const metadata = {
    ...(asset.id ? { id: asset.id } : {}),
    name,
    type,
    owner,
    fileName,
    mimeType,
    size: asset.size || "",
    uploadKey
  };
  const startPayload = { ...metadata, totalBytes };
  let startResult = await requestStartWithRetries(startPayload, totalBytes, recoveryOptions);

  if (startResult.uploadComplete) {
    return startResult.asset;
  }

  let uploadUrl = startResult.uploadUrl;
  let currentByte = startResult.nextByte;
  let sessionRestarts = 0;
  let chunkRetriesAtCurrentByte = 0;
  let noProgressCycles = 0;

  async function restartSession() {
    if (sessionRestarts >= MAX_SESSION_RESTARTS) {
      throw new Error(SESSION_RESTART_FAILED_MESSAGE);
    }

    sessionRestarts += 1;
    startResult = await requestStartWithRetries(startPayload, totalBytes, recoveryOptions);
    if (startResult.uploadComplete) {
      return startResult;
    }

    uploadUrl = startResult.uploadUrl;
    currentByte = startResult.nextByte;
    chunkRetriesAtCurrentByte = 0;
    noProgressCycles = 0;
    return null;
  }

  async function queryCurrentStatus() {
    return requestStatusWithRetries(
      {
        ...metadata,
        totalBytes,
        uploadUrl
      },
      totalBytes,
      recoveryOptions
    );
  }

  async function recordProgress(nextByte: number) {
    if (nextByte === currentByte) {
      noProgressCycles += 1;
      if (noProgressCycles >= MAX_NO_PROGRESS_CYCLES) {
        throw new Error(NO_PROGRESS_MESSAGE);
      }
      await waitBeforeRetry(Math.min(noProgressCycles, MAX_CHUNK_RETRIES), recoveryOptions);
    } else {
      noProgressCycles = 0;
      chunkRetriesAtCurrentByte = 0;
    }
    currentByte = nextByte;
  }

  while (true) {
    if (currentByte === totalBytes) {
      try {
        const status = await queryCurrentStatus();
        if (status.uploadComplete) {
          return status.asset;
        }
        await recordProgress(status.nextByte);
      } catch (error) {
        if (!isExpiredMediaUploadSessionError(error)) {
          throw error;
        }
        const restarted = await restartSession();
        if (restarted?.uploadComplete) {
          return restarted.asset;
        }
      }
      continue;
    }

    const endByteExclusive = Math.min(totalBytes, currentByte + MEDIA_UPLOAD_CHUNK_BYTES);
    const chunkBase64 = sliceNormalizedBase64ByByteRange(normalizedBase64, totalBytes, currentByte, endByteExclusive);

    try {
      const rawResult = await requestMediaBridge<unknown>("uploadMediaChunk", {
        ...metadata,
        totalBytes,
        uploadUrl,
        chunkBase64,
        startByte: currentByte,
        endByte: endByteExclusive - 1
      });
      const result = validateUploadProgressResult(rawResult, totalBytes);
      if (result.uploadComplete) {
        return result.asset;
      }
      chunkRetriesAtCurrentByte = 0;
      await recordProgress(result.nextByte);
    } catch (error) {
      if (isExpiredMediaUploadSessionError(error)) {
        const restarted = await restartSession();
        if (restarted?.uploadComplete) {
          return restarted.asset;
        }
        continue;
      }

      if (!isTransientMediaBridgeError(error)) {
        throw error;
      }

      let status: MediaUploadStatusResult;
      try {
        status = await queryCurrentStatus();
      } catch (statusError) {
        if (!isExpiredMediaUploadSessionError(statusError)) {
          throw statusError;
        }
        const restarted = await restartSession();
        if (restarted?.uploadComplete) {
          return restarted.asset;
        }
        continue;
      }

      if (status.uploadComplete) {
        return status.asset;
      }

      if (status.nextByte === currentByte) {
        if (chunkRetriesAtCurrentByte >= MAX_CHUNK_RETRIES) {
          if (error instanceof Error) {
            error.message = RETRY_LIMIT_MESSAGE;
          }
          throw error;
        }
        chunkRetriesAtCurrentByte += 1;
      }
      await recordProgress(status.nextByte);
    }
  }
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
