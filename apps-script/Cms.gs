function upsertMedia(asset) {
  validateRequired(asset, ["name", "type", "owner"]);

  const uploadedFile = asset.fileBase64 ? createDriveFile(asset) : null;
  const mediaType = normalizeMediaType(asset.type);
  const driveUrl = uploadedFile ? uploadedFile.getUrl() : normalizePublicMediaUrlOrEmpty(asset.driveUrl || "");
  const fileId = uploadedFile ? uploadedFile.getId() : asset.fileId || extractDriveFileId(driveUrl);
  const mimeType = uploadedFile ? uploadedFile.getMimeType() : asset.mimeType || "";
  const thumbnailUrl = normalizePublicMediaUrlOrEmpty(
    asset.thumbnailUrl || (mediaType === "image" ? buildPreviewUrl(fileId, mediaType) : ""),
    ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS
  );
  const previewUrl = normalizePublicMediaUrlOrEmpty(
    asset.previewUrl || thumbnailUrl || buildPreviewUrl(fileId, mediaType),
    ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS
  );
  const embedUrl = normalizePublicMediaUrlOrEmpty(
    asset.embedUrl || buildEmbedUrl(fileId),
    ALLOWED_PUBLIC_MEDIA_EMBED_HOSTS
  );

  return {
    id: asset.id || fileId || `media-${Date.now()}`,
    name: String(asset.name || "").trim(),
    type: mediaType,
    size: uploadedFile ? formatBytes(uploadedFile.getSize()) : asset.size || "",
    owner: String(asset.owner || "").trim(),
    driveUrl,
    fileId,
    mimeType,
    thumbnailUrl,
    previewUrl,
    embedUrl,
    updatedAt: new Date().toISOString()
  };
}

function deleteMedia(input) {
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : { id: input };
  const id = String(payload.id || "").trim();

  if (!id) {
    throw createHttpError("Missing media id.", 400);
  }

  if (payload.deleteDriveFile !== false) {
    const fileId =
      String(payload.fileId || "").trim() ||
      extractDriveFileId(payload.driveUrl || "") ||
      extractDriveFileId(payload.previewUrl || "") ||
      extractDriveFileId(payload.embedUrl || "") ||
      id;

    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      console.warn(`Unable to trash Drive file ${fileId}: ${error.message || error}`);
    }
  }

  return {
    id,
    deleted: true
  };
}

function createDriveFile(asset) {
  const uploadFolder = resolveMediaUploadFolder();
  const contentType = resolveUploadMimeType(asset);
  const bytes = decodeUploadBytes(asset.fileBase64);
  const fileName = asset.fileName || asset.name;
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  const file = uploadFolder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

function startMediaUpload(asset) {
  const upload = validateResumableMediaPayload(asset);
  const uploadFolder = resolveMediaUploadFolder();
  const completed = findCompletedMediaAssetByUploadKey(asset, upload, uploadFolder.getId());

  if (completed) {
    return completed;
  }

  const response = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "post",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      "X-Upload-Content-Length": String(upload.totalBytes),
      "X-Upload-Content-Type": upload.contentType
    },
    contentType: "application/json; charset=UTF-8",
    payload: JSON.stringify({
      name: String(asset.fileName || asset.name).trim(),
      parents: [uploadFolder.getId()],
      appProperties: {
        [MEDIA_UPLOAD_KEY_PROPERTY]: upload.uploadKey
      }
    }),
    muteHttpExceptions: true,
    followRedirects: false
  });
  const responseCode = response.getResponseCode();

  if (isTransientDriveUploadStatus(responseCode)) {
    throw createDriveUploadTransientError(responseCode);
  }

  if (responseCode !== 200 && responseCode !== 201) {
    throw createHttpError("Drive rejected the upload-session request.", 400);
  }

  const uploadUrl = readResponseHeader(response, "Location");
  validateDriveResumableUploadUrl(uploadUrl);

  return {
    uploadComplete: false,
    uploadUrl,
    totalBytes: upload.totalBytes,
    chunkSizeBytes: MEDIA_UPLOAD_CHUNK_BYTES,
    nextByte: 0
  };
}

function uploadMediaChunk(asset) {
  validateRequired(asset, ["uploadUrl", "chunkBase64"]);
  const upload = validateResumableMediaPayload(asset);
  const startByte = normalizeUploadInteger(asset.startByte, "Invalid upload range.");
  const endByte = normalizeUploadInteger(asset.endByte, "Invalid upload range.");

  if (startByte < 0 || endByte < startByte || endByte >= upload.totalBytes) {
    throw createHttpError("Invalid upload range.", 400);
  }

  const uploadUrl = validateDriveResumableUploadUrl(asset.uploadUrl);
  const bytes = decodeUploadChunkBytes(asset.chunkBase64);
  const expectedChunkBytes = endByte - startByte + 1;
  const isFinalChunk = endByte + 1 === upload.totalBytes;

  if (bytes.length !== expectedChunkBytes || bytes.length > MEDIA_UPLOAD_CHUNK_BYTES) {
    throw createHttpError("Upload chunk size does not match its range.", 400);
  }

  if (!isFinalChunk && bytes.length % (256 * 1024) !== 0) {
    throw createHttpError("Non-final upload chunks must be aligned to 256 KiB.", 400);
  }

  const response = UrlFetchApp.fetch(uploadUrl, {
    method: "put",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      "Content-Range": `bytes ${startByte}-${endByte}/${upload.totalBytes}`
    },
    contentType: upload.contentType,
    payload: bytes,
    muteHttpExceptions: true,
    followRedirects: false
  });
  const responseCode = response.getResponseCode();

  if (responseCode === 308) {
    return {
      uploadComplete: false,
      nextByte: readDriveAcknowledgedNextByte(response, upload.totalBytes)
    };
  }

  if (responseCode === 404 || responseCode === 410) {
    const uploadFolder = resolveMediaUploadFolder();
    const completed = findCompletedMediaAssetByUploadKey(asset, upload, uploadFolder.getId());
    if (completed) {
      return completed;
    }
    throw createMediaUploadSessionExpiredError();
  }

  if (isTransientDriveUploadStatus(responseCode)) {
    throw createDriveUploadTransientError(responseCode);
  }

  if (responseCode !== 200 && responseCode !== 201) {
    throw createHttpError("Drive rejected the media upload chunk.", 400);
  }

  const completed = buildCompletedMediaResultFromDriveResponse(asset, upload.mediaType, response);
  if (completed) {
    return completed;
  }

  const uploadFolder = resolveMediaUploadFolder();
  const recovered = findCompletedMediaAssetByUploadKey(asset, upload, uploadFolder.getId());
  if (recovered) {
    return recovered;
  }

  throw createHttpError(
    "Drive completed the upload without recoverable file metadata.",
    502,
    "DRIVE_UPLOAD_AMBIGUOUS_COMPLETION"
  );
}

function queryMediaUploadStatus(asset) {
  validateRequired(asset, ["uploadUrl"]);
  const upload = validateResumableMediaPayload(asset);
  const uploadUrl = validateDriveResumableUploadUrl(asset.uploadUrl);
  const uploadFolder = resolveMediaUploadFolder();
  let completed = findCompletedMediaAssetByUploadKey(asset, upload, uploadFolder.getId());

  if (completed) {
    return completed;
  }

  const response = UrlFetchApp.fetch(uploadUrl, {
    method: "put",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      "Content-Range": `bytes */${upload.totalBytes}`
    },
    muteHttpExceptions: true,
    followRedirects: false
  });
  const responseCode = response.getResponseCode();

  if (responseCode === 308) {
    return {
      uploadComplete: false,
      nextByte: readDriveAcknowledgedNextByte(response, upload.totalBytes)
    };
  }

  if (responseCode === 200 || responseCode === 201) {
    completed = buildCompletedMediaResultFromDriveResponse(asset, upload.mediaType, response);
    if (completed) {
      return completed;
    }
    completed = findCompletedMediaAssetByUploadKey(asset, upload, uploadFolder.getId());
    if (completed) {
      return completed;
    }
    throw createHttpError(
      "Drive completed the upload without recoverable file metadata.",
      502,
      "DRIVE_UPLOAD_AMBIGUOUS_COMPLETION"
    );
  }

  if (responseCode === 404 || responseCode === 410) {
    completed = findCompletedMediaAssetByUploadKey(asset, upload, uploadFolder.getId());
    if (completed) {
      return completed;
    }
    throw createMediaUploadSessionExpiredError();
  }

  if (isTransientDriveUploadStatus(responseCode)) {
    throw createDriveUploadTransientError(responseCode);
  }

  throw createHttpError("Drive rejected the upload status request.", 400);
}

function validateResumableMediaPayload(asset) {
  validateRequired(asset, ["name", "type", "owner", "fileName", "mimeType", "uploadKey"]);
  const mediaType = normalizeMediaType(asset.type);
  const contentType = resolveUploadMimeType(asset);
  const totalBytes = normalizeUploadInteger(asset.totalBytes, "Invalid total upload size.");
  const uploadKey = normalizeMediaUploadKey(asset.uploadKey);

  if (totalBytes < 1 || totalBytes > MAX_UPLOAD_BYTES) {
    throw createHttpError("File upload must be between 1 byte and 10 MB.", 413);
  }

  return {
    mediaType,
    contentType,
    totalBytes,
    uploadKey
  };
}

function normalizeMediaUploadKey(value) {
  const uploadKey = String(value || "").trim();
  if (!MEDIA_UPLOAD_KEY_PATTERN.test(uploadKey)) {
    throw createHttpError("Invalid media upload key.", 400);
  }
  return uploadKey;
}

function escapeDriveQueryValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function findCompletedMediaFileByUploadKey(uploadKey, folderId) {
  const query = [
    `'${escapeDriveQueryValue(folderId)}' in parents`,
    "trashed = false",
    `appProperties has { key='${MEDIA_UPLOAD_KEY_PROPERTY}' and value='${escapeDriveQueryValue(uploadKey)}' }`
  ].join(" and ");
  const fields = "files(id,name,mimeType,size,webViewLink,createdTime)";
  const url =
    "https://www.googleapis.com/drive/v3/files" +
    `?q=${encodeURIComponent(query)}` +
    "&spaces=drive" +
    "&pageSize=2" +
    `&orderBy=${encodeURIComponent("createdTime desc")}` +
    `&fields=${encodeURIComponent(fields)}`;
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
    },
    muteHttpExceptions: true,
    followRedirects: false
  });
  const responseCode = response.getResponseCode();

  if (isTransientDriveUploadStatus(responseCode)) {
    throw createDriveUploadTransientError(responseCode);
  }
  if (responseCode !== 200) {
    throw createHttpError("Unable to verify an existing Drive upload.", 400);
  }

  let result;
  try {
    result = JSON.parse(response.getContentText() || "{}");
  } catch (error) {
    throw createHttpError("Drive returned an invalid file lookup result.", 502);
  }

  const files = result && Array.isArray(result.files) ? result.files : [];
  if (files.length > 1) {
    console.warn("Multiple completed media files were found for one upload operation.");
  }

  for (let index = 0; index < files.length; index += 1) {
    const fileId = String((files[index] && files[index].id) || "").trim();
    if (!fileId) {
      continue;
    }
    try {
      return DriveApp.getFileById(fileId);
    } catch (error) {
      console.warn("A completed media upload lookup returned an inaccessible Drive file.");
    }
  }

  return null;
}

function findCompletedMediaAssetByUploadKey(asset, upload, folderId) {
  const file = findCompletedMediaFileByUploadKey(upload.uploadKey, folderId);
  if (!file) {
    return null;
  }

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    uploadComplete: true,
    asset: buildMediaAssetFromDriveFile(asset, file, upload.mediaType)
  };
}

function buildCompletedMediaResultFromDriveResponse(asset, mediaType, response) {
  let driveResult;
  try {
    driveResult = JSON.parse(response.getContentText() || "{}");
  } catch (error) {
    return null;
  }

  const fileId = String((driveResult && driveResult.id) || "").trim();
  if (!fileId) {
    return null;
  }

  const uploadedFile = DriveApp.getFileById(fileId);
  uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    uploadComplete: true,
    asset: buildMediaAssetFromDriveFile(asset, uploadedFile, mediaType)
  };
}

function readDriveAcknowledgedNextByte(response, totalBytes) {
  const range = readResponseHeader(response, "Range");
  if (!range) {
    return 0;
  }

  const match = range.match(/^bytes=0-(\d+)$/i);
  const nextByte = match ? Number(match[1]) + 1 : -1;
  if (!Number.isSafeInteger(nextByte) || nextByte < 0 || nextByte > totalBytes) {
    throw createHttpError("Drive returned an invalid upload range.", 502);
  }
  return nextByte;
}

function isTransientDriveUploadStatus(statusCode) {
  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode <= 599);
}

function createDriveUploadTransientError(statusCode) {
  const safeStatus = statusCode === 408 || statusCode === 429 ? statusCode : 503;
  return createHttpError("Drive media upload is temporarily unavailable.", safeStatus, "DRIVE_UPLOAD_TRANSIENT");
}

function createMediaUploadSessionExpiredError() {
  return createHttpError(
    "Media upload session expired. Please retry the upload.",
    410,
    "MEDIA_UPLOAD_SESSION_EXPIRED"
  );
}

function buildMediaAssetFromDriveFile(asset, uploadedFile, mediaType) {
  const fileId = uploadedFile.getId();
  const thumbnailUrl = mediaType === "image" ? buildPreviewUrl(fileId, mediaType) : "";
  const embedUrl = buildEmbedUrl(fileId);

  return {
    id: asset.id || fileId || `media-${Date.now()}`,
    name: String(asset.name || "").trim(),
    type: mediaType,
    size: formatBytes(uploadedFile.getSize()),
    owner: String(asset.owner || "").trim(),
    driveUrl: uploadedFile.getUrl(),
    fileId,
    mimeType: uploadedFile.getMimeType(),
    thumbnailUrl,
    previewUrl: thumbnailUrl || embedUrl,
    embedUrl,
    updatedAt: new Date().toISOString()
  };
}

function normalizeUploadInteger(value, message) {
  const numberValue = Number(value);

  if (!Number.isSafeInteger(numberValue)) {
    throw createHttpError(message, 400);
  }

  return numberValue;
}

function decodeUploadChunkBytes(chunkBase64) {
  const normalized = String(chunkBase64 || "").replace(/\s+/g, "");
  const paddingLength = normalized.slice(-2) === "==" ? 2 : normalized.slice(-1) === "=" ? 1 : 0;
  const unpadded = paddingLength ? normalized.slice(0, -paddingLength) : normalized;
  const paddingIsValid =
    (paddingLength === 0 && unpadded.length % 4 === 0) ||
    (paddingLength === 1 && unpadded.length % 4 === 3) ||
    (paddingLength === 2 && unpadded.length % 4 === 2);

  if (
    !unpadded ||
    !paddingIsValid ||
    unpadded.indexOf("=") !== -1 ||
    !/^[A-Za-z0-9+/]+$/.test(unpadded)
  ) {
    throw createHttpError("Invalid upload chunk data.", 400);
  }

  try {
    return Utilities.base64Decode(normalized);
  } catch (error) {
    throw createHttpError("Invalid upload chunk data.", 400);
  }
}

function validateDriveResumableUploadUrl(value) {
  const uploadUrl = String(value || "").trim();

  if (
    /[\u0000-\u001F\u007F\s\\]/.test(uploadUrl) ||
    !/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[^#]+$/i.test(uploadUrl)
  ) {
    throw createHttpError("Invalid Drive upload session.", 400);
  }

  const query = uploadUrl.split("?")[1] || "";
  const uploadType = readQueryParameter(query, "uploadType");
  const uploadId = readQueryParameter(query, "upload_id");

  if (uploadType !== "resumable" || !uploadId) {
    throw createHttpError("Invalid Drive upload session.", 400);
  }

  return uploadUrl;
}

function readQueryParameter(query, name) {
  const pairs = String(query || "").split("&");

  for (let index = 0; index < pairs.length; index += 1) {
    const parts = pairs[index].split("=");
    try {
      if (decodeURIComponent(parts[0] || "") === name) {
        return decodeURIComponent(parts.slice(1).join("=") || "");
      }
    } catch (error) {
      return "";
    }
  }

  return "";
}

function readResponseHeader(response, name) {
  const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
  const target = String(name || "").toLowerCase();
  const keys = Object.keys(headers || {});

  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index].toLowerCase() === target) {
      return String(headers[keys[index]] || "").trim();
    }
  }

  return "";
}

function resolveUploadMimeType(asset) {
  const contentType = normalizeUploadMimeType(asset.mimeType || parseDataUrlMimeType(asset.fileBase64));

  if (!isAllowedUploadMimeType(contentType)) {
    throw createHttpError("Unsupported file type.", 400);
  }

  return contentType;
}

function parseDataUrlMimeType(value) {
  const match = String(value || "").match(/^data:([^;,]+)[;,]/i);
  return match && match[1] ? match[1] : "";
}

function normalizeUploadMimeType(value) {
  return String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function isAllowedUploadMimeType(value) {
  const contentType = normalizeUploadMimeType(value);

  if (contentType.indexOf("image/") === 0 || contentType.indexOf("video/") === 0) {
    return true;
  }

  return ALLOWED_EXACT_UPLOAD_MIME_TYPES.indexOf(contentType) !== -1;
}

function decodeUploadBytes(fileBase64) {
  let bytes;

  try {
    bytes = Utilities.base64Decode(stripDataUrlPrefix(fileBase64));
  } catch (error) {
    throw createHttpError("Invalid file upload data.", 400);
  }

  validateUploadBytes(bytes);
  return bytes;
}

function validateUploadBytes(bytes) {
  if (!bytes || bytes.length < 1 || bytes.length > MAX_UPLOAD_BYTES) {
    throw createHttpError("File upload exceeds the 10 MB limit.", 413);
  }
}

function resolveMediaUploadFolder() {
  const folders = ensureFolders();
  return DriveApp.getFolderById(folders.driveFolderId);
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:[^;]+;base64,/, "");
}

function normalizeMediaType(value) {
  const mediaType = String(value || "")
    .trim()
    .toLowerCase();

  if (ALLOWED_MEDIA_TYPES.indexOf(mediaType) === -1) {
    throw createHttpError("Invalid media type.", 400);
  }

  return mediaType;
}

function extractDriveFileId(url) {
  if (!url) {
    return "";
  }

  const patterns = [/\/file\/d\/([^/]+)/, /[?&]id=([^&]+)/, /\/d\/([^/]+)/];

  for (let index = 0; index < patterns.length; index += 1) {
    const match = String(url).match(patterns[index]);

    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

function buildPreviewUrl(fileId, type) {
  if (!fileId) {
    return "";
  }

  if (type === "image") {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
  }

  return buildEmbedUrl(fileId);
}

function buildEmbedUrl(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : "";
}

function normalizePublicMediaUrl(url, allowedHosts) {
  const value = String(url || "").trim();
  const hostAllowlist = allowedHosts || [];

  if (!value) {
    return "";
  }

  if (/[\u0000-\u001F\u007F\s\\]/.test(value)) {
    throw createHttpError("Invalid public URL.", 400);
  }

  const protocolMatch = value.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);

  if (!protocolMatch) {
    throw createHttpError("Public URL must use https.", 400);
  }

  const protocol = `${protocolMatch[1].toLowerCase()}:`;

  if (protocol !== "https:") {
    throw createHttpError("Public URL must use https.", 400);
  }

  const hostMatch = value.match(/^https:\/\/([^/?#]+)(?:[/?#]|$)/i);

  if (!hostMatch || !hostMatch[1] || hostMatch[1].indexOf("@") !== -1) {
    throw createHttpError("Invalid public URL.", 400);
  }

  const hostname = hostMatch[1].split(":")[0].toLowerCase();

  if (hostAllowlist.length && hostAllowlist.indexOf(hostname) === -1) {
    throw createHttpError("Public media preview/embed URL host is not allowed.", 400);
  }

  return value;
}

function normalizePublicMediaUrlOrEmpty(url, allowedHosts) {
  try {
    return normalizePublicMediaUrl(url, allowedHosts);
  } catch (error) {
    console.warn(`Dropping unsafe public URL: ${error.message || error}`);
    return "";
  }
}

function formatBytes(size) {
  if (!size) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
