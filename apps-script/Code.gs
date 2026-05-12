const EDITOR_WRITE_RESOURCES = [
  "content",
  "content-delete",
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
const PUBLIC_POST_RESOURCES = ["content-view"];

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
    const payload = parsePayload(event);
    const query = getQueryParams(event);
    const authContext = shouldReadAuthContext(method, resource) ? getRequestAuthContext(payload) : null;

    assertRouteAccess(method, resource, authContext);

    if (method === "GET" && resource === "snapshot") {
      const snapshot = authContext
        ? getSnapshot({
            includeUnpublished: false
          })
        : getPublicSnapshotCached();

      return jsonResponse(snapshot);
    }

    if (method === "GET" && resource === "public-home") {
      return jsonResponse(getPublicHomeSnapshot());
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
      return jsonResponse(
        getContentDetail(query, {
          includeUnpublished: false
        })
      );
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

    if (method === "POST" && resource === "content") {
      return jsonResponse(upsertContent(payload));
    }

    if (method === "POST" && resource === "content-delete") {
      return jsonResponse(deleteContent(payload.id));
    }

    if (method === "POST" && resource === "carousel") {
      return jsonResponse(upsertCarouselSlide(payload));
    }

    if (method === "POST" && resource === "carousel-delete") {
      return jsonResponse(deleteCarouselSlide(payload.id));
    }

    if (method === "POST" && resource === "external-service") {
      return jsonResponse(upsertExternalService(payload));
    }

    if (method === "POST" && resource === "external-service-delete") {
      return jsonResponse(deleteExternalService(payload.id));
    }

    if (method === "POST" && resource === "media") {
      return jsonResponse(upsertMedia(payload));
    }

    if (method === "POST" && resource === "media-delete") {
      return jsonResponse(deleteMedia(payload.id, payload.deleteDriveFile !== false));
    }

    if (method === "POST" && resource === "event") {
      return jsonResponse(upsertEvent(payload));
    }

    if (method === "POST" && resource === "event-delete") {
      return jsonResponse(deleteEvent(payload.id));
    }

    if (method === "POST" && resource === "publish") {
      return jsonResponse(publishContent(payload.id));
    }

    if (method === "POST" && resource === "menu") {
      return jsonResponse({
        items: replaceMenu(payload.items || [])
      });
    }

    if (method === "POST" && resource === "display-settings") {
      return jsonResponse(updateDisplaySettings(payload));
    }

    if (method === "POST" && resource === "site-settings") {
      requireMinimumRole(authContext, "admin");
      return jsonResponse(updateSiteSettings(payload));
    }

    if (method === "POST" && resource === "homepage-settings") {
      requireMinimumRole(authContext, "admin");
      return jsonResponse(updateHomepageSettings(payload));
    }

    if (method === "POST" && resource === "visitor-stats") {
      requireMinimumRole(authContext, "admin");
      return jsonResponse(updateVisitorStats(payload));
    }

    if (method === "POST" && resource === "users") {
      if (payload.action === "list") {
        return jsonResponse({
          items: getUsers()
        });
      }

      return jsonResponse(upsertUser(payload));
    }

    if (method === "POST" && resource === "users-delete") {
      return jsonResponse(deleteUser(payload.id));
    }

    if (method === "POST" && resource === "users-reset") {
      return jsonResponse({
        items: resetUsers()
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

function shouldReadAuthContext(method, resource) {
  return method === "POST" && resource !== "auth-login" && PUBLIC_POST_RESOURCES.indexOf(resource) === -1;
}

function assertRouteAccess(method, resource, authContext) {
  if (method === "POST" && resource === "auth-login") {
    return;
  }

  if (
    method === "GET" &&
    (resource === "snapshot" || resource === "public-home" || resource === "health" || resource === "menu")
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
