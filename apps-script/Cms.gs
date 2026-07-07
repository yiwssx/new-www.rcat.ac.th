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
  if (!bytes || bytes.length > MAX_UPLOAD_BYTES) {
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
