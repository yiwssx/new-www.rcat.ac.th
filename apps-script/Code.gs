const EDITOR_WRITE_RESOURCES = [
  "content",
  "content-delete",
  "document",
  "document-delete",
  "carousel",
  "carousel-delete",
  "external-service",
  "external-service-delete",
  "media",
  "media-delete",
  "event",
  "event-delete",
  "publish",
  "menu",
  "display-settings"
];

const ADMIN_ONLY_RESOURCES = [
  "site-settings",
  "homepage-settings",
  "visitor-stats",
  "users",
  "users-delete",
  "users-reset"
];
const PUBLIC_POST_RESOURCES = ["content-view", "site-view"];
const MEDIA_BRIDGE_RESOURCES = ["media", "media-delete"];

const AUTH_SESSION_HOURS_FALLBACK = 8;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

function doGet(event) {
  return routeRequest(event, "GET");
}

function doPost(event) {
  return routeRequest(event, "POST");
}

function routeRequest(event, method) {
  try {
    ensureDefaultScriptProperties();
    ensureAuthTokenSecret();

    const resource = getResource(event);
    let payload = parsePayload(event);
    const query = getQueryParams(event);
    const publicPerformanceDebugOptions = {
      debugPerformance: isPublicPerformanceDebugEnabled(query)
    };
    const hasValidMediaBridgeToken = isMediaBridgeRequest(method, resource) && hasValidAppsScriptBridgeToken(payload);
    const authContext =
      shouldReadAuthContext(method, resource) && !hasValidMediaBridgeToken ? getRequestAuthContext(payload) : null;

    assertRouteAccess(method, resource, authContext, hasValidMediaBridgeToken);

    if (hasValidMediaBridgeToken) {
      payload = stripAppsScriptBridgeTokens(payload);
    }

    if (method === "GET" && resource === "snapshot") {
      const snapshot = authContext
        ? getSnapshot({
            includeUnpublished: false
          })
        : getPublicSnapshotCached(publicPerformanceDebugOptions);

      return jsonResponse(snapshot);
    }

    if (method === "GET" && resource === "public-home") {
      return jsonResponse(getPublicHomeSnapshotCached(publicPerformanceDebugOptions));
    }

    if (method === "GET" && resource === "public-content-list") {
      return jsonResponse(getPublicContentListSnapshotCached(query, publicPerformanceDebugOptions));
    }

    if (method === "GET" && resource === "public-document-list") {
      return jsonResponse(getPublicDocumentListCached(publicPerformanceDebugOptions));
    }

    if (method === "GET" && resource === "public-program-list") {
      return jsonResponse(getPublicProgramListSnapshotCached(publicPerformanceDebugOptions));
    }

    if (method === "GET" && resource === "public-search-index") {
      return jsonResponse(getPublicSearchIndexSnapshotCached(publicPerformanceDebugOptions));
    }

    if (method === "GET" && resource === "health") {
      return jsonResponse({
        ok: true,
        hasSpreadsheet: Boolean(getSetting(SETTING_KEYS.spreadsheetId)),
        hasDriveFolder: Boolean(getSetting(SETTING_KEYS.driveFolderId)),
        hasDocsFolder: Boolean(getSetting(SETTING_KEYS.docsFolderId)),
        timestamp: new Date().toISOString()
      });
    }

    if (method === "GET" && resource === "menu") {
      return jsonResponse({
        items: getMenu()
      });
    }

    if (method === "GET" && resource === "display-settings") {
      return jsonResponse(getDisplaySettings());
    }

    if (method === "GET" && resource === "content-detail") {
      return jsonResponse(getPublicContentDetailCached(query, publicPerformanceDebugOptions));
    }

    if (method === "POST" && resource === "auth-login") {
      return jsonResponse(loginUser(payload));
    }

    if (method === "POST" && resource === "snapshot-admin") {
      requireMinimumRole(authContext, "editor");
      return jsonResponse(
        getSnapshot({
          includeUnpublished: true
        })
      );
    }

    if (method === "POST" && resource === "content-detail-admin") {
      requireMinimumRole(authContext, "editor");
      return jsonResponse(
        getContentDetail(payload, {
          includeUnpublished: true
        })
      );
    }

    if (method === "POST" && resource === "content-view") {
      return jsonResponse(incrementContentView(payload));
    }

    if (method === "POST" && resource === "site-view") {
      return jsonResponse(incrementSiteView(payload));
    }

    if (method === "POST" && resource === "content") {
      return jsonResponse(withScriptLock(() => upsertContent(payload)));
    }

    if (method === "POST" && resource === "content-delete") {
      return jsonResponse(withScriptLock(() => deleteContent(payload.id)));
    }

    if (method === "POST" && resource === "document") {
      return jsonResponse(withScriptLock(() => upsertDocument(payload)));
    }

    if (method === "POST" && resource === "document-delete") {
      return jsonResponse(withScriptLock(() => deleteDocument(payload.id)));
    }

    if (method === "POST" && resource === "carousel") {
      return jsonResponse(withScriptLock(() => upsertCarouselSlide(payload)));
    }

    if (method === "POST" && resource === "carousel-delete") {
      return jsonResponse(withScriptLock(() => deleteCarouselSlide(payload.id)));
    }

    if (method === "POST" && resource === "external-service") {
      return jsonResponse(withScriptLock(() => upsertExternalService(payload)));
    }

    if (method === "POST" && resource === "external-service-delete") {
      return jsonResponse(withScriptLock(() => deleteExternalService(payload.id)));
    }

    if (method === "POST" && resource === "media") {
      return jsonResponse(withScriptLock(() => upsertMedia(payload)));
    }

    if (method === "POST" && resource === "media-delete") {
      return jsonResponse(withScriptLock(() => deleteMedia(payload.id, payload.deleteDriveFile !== false)));
    }

    if (method === "POST" && resource === "event") {
      return jsonResponse(withScriptLock(() => upsertEvent(payload)));
    }

    if (method === "POST" && resource === "event-delete") {
      return jsonResponse(withScriptLock(() => deleteEvent(payload.id)));
    }

    if (method === "POST" && resource === "publish") {
      return jsonResponse(withScriptLock(() => publishContent(payload.id)));
    }

    if (method === "POST" && resource === "menu") {
      return jsonResponse({
        items: withScriptLock(() => replaceMenu(payload.items || []))
      });
    }

    if (method === "POST" && resource === "display-settings") {
      return jsonResponse(withScriptLock(() => updateDisplaySettings(payload)));
    }

    if (method === "POST" && resource === "site-settings") {
      requireMinimumRole(authContext, "admin");
      return jsonResponse(withScriptLock(() => updateSiteSettings(payload)));
    }

    if (method === "POST" && resource === "homepage-settings") {
      requireMinimumRole(authContext, "admin");
      return jsonResponse(withScriptLock(() => updateHomepageSettings(payload)));
    }

    if (method === "POST" && resource === "visitor-stats") {
      requireMinimumRole(authContext, "admin");
      return jsonResponse(withScriptLock(() => updateVisitorStats(payload)));
    }

    if (method === "POST" && resource === "users") {
      if (payload.action === "list") {
        return jsonResponse({
          items: getUsers()
        });
      }

      return jsonResponse(withScriptLock(() => upsertUser(payload)));
    }

    if (method === "POST" && resource === "users-delete") {
      return jsonResponse(withScriptLock(() => deleteUser(payload.id)));
    }

    if (method === "POST" && resource === "users-reset") {
      return jsonResponse({
        items: withScriptLock(() => resetUsers())
      });
    }

    return jsonResponse(
      {
        error: "Unknown route",
        resource,
        method
      },
      404
    );
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    console.error(error);
    return jsonResponse(
      {
        error: error.message || String(error)
      },
      statusCode
    );
  }
}

function isPublicPerformanceDebugEnabled(query) {
  return String((query && query.debugPerformance) || "").trim() === "1";
}

function shouldReadAuthContext(method, resource) {
  return method === "POST" && resource !== "auth-login" && PUBLIC_POST_RESOURCES.indexOf(resource) === -1;
}

function assertRouteAccess(method, resource, authContext, hasValidMediaBridgeToken) {
  if (method === "POST" && resource === "auth-login") {
    return;
  }

  if (
    method === "GET" &&
    (resource === "snapshot" ||
      resource === "public-home" ||
      resource === "public-content-list" ||
      resource === "public-document-list" ||
      resource === "public-program-list" ||
      resource === "public-search-index" ||
      resource === "health" ||
      resource === "menu")
  ) {
    return;
  }

  if (method === "GET" && resource === "display-settings") {
    return;
  }

  if (method === "GET" && resource === "content-detail") {
    return;
  }

  if (method === "POST" && PUBLIC_POST_RESOURCES.indexOf(resource) !== -1) {
    return;
  }

  if (method === "POST" && ADMIN_ONLY_RESOURCES.indexOf(resource) !== -1) {
    requireMinimumRole(authContext, "admin");
    return;
  }

  if (method === "POST" && EDITOR_WRITE_RESOURCES.indexOf(resource) !== -1) {
    if (hasValidMediaBridgeToken && isMediaBridgeRequest(method, resource)) {
      return;
    }

    requireMinimumRole(authContext, "editor");
  }
}

function requireMinimumRole(authContext, requiredRole) {
  if (!authContext || !authContext.user) {
    throw createHttpError("Authentication is required.", 401);
  }

  const currentRank = getRoleRank(authContext.user.role);
  const requiredRank = getRoleRank(requiredRole);

  if (currentRank < requiredRank) {
    throw createHttpError("You do not have permission for this action.", 403);
  }
}

function getRoleRank(role) {
  if (role === "admin") {
    return 2;
  }

  if (role === "editor") {
    return 1;
  }

  return 0;
}

function getRequestAuthContext(payload) {
  const token = extractAuthToken(payload);

  if (!token) {
    return null;
  }

  return verifyAuthToken(token);
}

function isMediaBridgeRequest(method, resource) {
  return method === "POST" && MEDIA_BRIDGE_RESOURCES.indexOf(resource) !== -1;
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

function stripAppsScriptBridgeTokens(payload) {
  const sanitizedPayload = Object.assign({}, payload);
  delete sanitizedPayload.appsScriptBridgeToken;
  delete sanitizedPayload.mediaBridgeToken;
  return sanitizedPayload;
}

function extractAuthToken(payload) {
  const payloadToken = payload && payload.authToken ? String(payload.authToken) : "";
  return payloadToken || "";
}

function ensureAuthTokenSecret() {
  const currentSecret = getSetting(SETTING_KEYS.authTokenSecret);

  if (currentSecret) {
    return currentSecret;
  }

  const generated = `${Utilities.getUuid().replace(/-/g, "")}${Utilities.getUuid().replace(/-/g, "")}`;
  setSetting(SETTING_KEYS.authTokenSecret, generated);
  return generated;
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode || 500;
  return error;
}

function getErrorStatusCode(error) {
  if (!error || typeof error.statusCode !== "number") {
    return 500;
  }

  return error.statusCode;
}
