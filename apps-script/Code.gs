const MEDIA_BRIDGE_RESOURCES = [
  "media",
  "media-delete",
  "media-upload-start",
  "media-upload-chunk",
  "media-upload-status"
];

function doGet(event) {
  return routeRequest(event, "GET");
}

function doPost(event) {
  return routeRequest(event, "POST");
}

function routeRequest(event, method) {
  let requestUploadKey = "";

  try {
    ensureDefaultScriptProperties();

    const resource = getResource(event);
    let payload = parsePayload(event);
    requestUploadKey = payload && payload.uploadKey ? String(payload.uploadKey) : "";

    if (method === "GET" && !resource) {
      return jsonResponse({
        ok: true,
        scope: "media-file-bridge",
        resources: MEDIA_BRIDGE_RESOURCES
      });
    }

    if (method === "POST" && resource === "media") {
      assertValidAppsScriptBridgeToken(payload);
      payload = stripAppsScriptBridgeTokens(payload);
      return jsonResponse(withScriptLock(() => upsertMedia(payload)));
    }

    if (method === "POST" && resource === "media-delete") {
      assertValidAppsScriptBridgeToken(payload);
      payload = stripAppsScriptBridgeTokens(payload);
      return jsonResponse(withScriptLock(() => deleteMedia(payload)));
    }

    if (method === "POST" && resource === "media-upload-start") {
      assertValidAppsScriptBridgeToken(payload);
      payload = stripAppsScriptBridgeTokens(payload);
      return jsonResponse(withScriptLock(() => startMediaUpload(payload)));
    }

    if (method === "POST" && resource === "media-upload-chunk") {
      assertValidAppsScriptBridgeToken(payload);
      payload = stripAppsScriptBridgeTokens(payload);
      return jsonResponse(uploadMediaChunk(payload));
    }

    if (method === "POST" && resource === "media-upload-status") {
      assertValidAppsScriptBridgeToken(payload);
      payload = stripAppsScriptBridgeTokens(payload);
      return jsonResponse(queryMediaUploadStatus(payload));
    }

    throw createHttpError("Unknown Apps Script media bridge route.", 404);
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    console.error(
      `Media bridge request failed (${statusCode}): ${sanitizeMediaBridgeLogMessage(error, requestUploadKey)}`
    );
    const errorPayload = {
      error:
        error && typeof error.statusCode === "number"
          ? error.message || "Media bridge request failed."
          : "Media bridge request failed."
    };

    if (error && ALLOWED_MEDIA_UPLOAD_ERROR_CODES.indexOf(error.code) !== -1) {
      errorPayload.code = error.code;
    }

    return jsonResponse(errorPayload, statusCode);
  }
}

function sanitizeMediaBridgeLogMessage(error, uploadKey) {
  let message = String((error && error.message) || error || "Unknown error");

  if (uploadKey) {
    message = message.split(uploadKey).join("[redacted-upload-key]");
  }

  return message
    .replace(/https:\/\/www\.googleapis\.com\/[^\s]+/gi, "[redacted-google-api-url]")
    .replace(/([?&]upload_id=)[^\s&]+/gi, "$1[redacted]")
    .replace(/("?(?:uploadKey|rcatUploadKey)"?\s*[=:]\s*)[^\s,;}]+/gi, "$1[redacted]")
    .replace(/(?:oauth|bearer|token)\s*[=:]?\s*[^\s,;]+/gi, "[redacted-token]")
    .slice(0, 300);
}

function readConfiguredAppsScriptBridgeTokens() {
  const primaryToken = String(getSetting(SETTING_KEYS.appsScriptBridgeToken) || "").trim();
  const fallbackToken = String(getSetting(SETTING_KEYS.mediaBridgeToken) || "").trim();
  const tokens = [];

  if (primaryToken) {
    tokens.push(primaryToken);
  }

  if (fallbackToken && fallbackToken !== primaryToken) {
    tokens.push(fallbackToken);
  }

  return tokens;
}

function readRequestAppsScriptBridgeToken(payload) {
  if (!payload) {
    return "";
  }

  const primaryToken = payload.appsScriptBridgeToken ? String(payload.appsScriptBridgeToken).trim() : "";

  if (primaryToken) {
    return primaryToken;
  }

  return payload.mediaBridgeToken ? String(payload.mediaBridgeToken).trim() : "";
}

function tokensMatch(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  const maxLength = Math.max(actual.length, expected.length);
  let difference = actual.length === expected.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    difference |= (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function hasValidAppsScriptBridgeToken(payload) {
  const requestToken = readRequestAppsScriptBridgeToken(payload);
  return readConfiguredAppsScriptBridgeTokens().some((configuredToken) => tokensMatch(requestToken, configuredToken));
}

function assertValidAppsScriptBridgeToken(payload) {
  if (!hasValidAppsScriptBridgeToken(payload)) {
    throw createHttpError("Apps Script media bridge token is invalid or missing.", 401);
  }
}

function stripAppsScriptBridgeTokens(payload) {
  const sanitizedPayload = Object.assign({}, payload);
  delete sanitizedPayload.appsScriptBridgeToken;
  delete sanitizedPayload.mediaBridgeToken;
  return sanitizedPayload;
}

function createHttpError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode || 500;
  if (ALLOWED_MEDIA_UPLOAD_ERROR_CODES.indexOf(code) !== -1) {
    error.code = code;
  }
  return error;
}

function getErrorStatusCode(error) {
  if (!error || typeof error.statusCode !== "number") {
    return 500;
  }

  return error.statusCode;
}
