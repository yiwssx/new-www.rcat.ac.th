import { describe, expect, it, vi, type Mock } from "vitest";
import codeSource from "../../apps-script/Code.gs?raw";
import configSource from "../../apps-script/Config.gs?raw";
import locksSource from "../../apps-script/Locks.gs?raw";

interface RouteResult {
  body: Record<string, unknown>;
  statusCode: number;
}

interface CodeScriptContext {
  deleteContent: Mock;
  deleteEvent: Mock;
  deleteMedia: Mock;
  getPublicContentDetailCached: Mock;
  getPublicContentListSnapshotCached: Mock;
  extractAuthToken: (payload: Record<string, unknown>, query?: Record<string, unknown>) => string;
  getPublicContentListSnapshot: Mock;
  getPublicHomeSnapshotCached: Mock;
  getPublicHomeSnapshot: Mock;
  getPublicProgramListSnapshotCached: Mock;
  getPublicProgramListSnapshot: Mock;
  getPublicSearchIndexSnapshotCached: Mock;
  getPublicSearchIndexSnapshot: Mock;
  getUsers: Mock;
  incrementContentView: Mock;
  lockService: {
    getScriptLock: Mock;
  };
  publishContent: Mock;
  replaceMenu: Mock;
  resetUsers: Mock;
  routeRequest: (event: Record<string, unknown>, method: string) => RouteResult;
  scriptLock: {
    tryLock: Mock;
    releaseLock: Mock;
  };
  shouldReadAuthContext: (method: string, resource: string) => boolean;
  upsertContent: Mock;
  upsertCarouselSlide: Mock;
  deleteCarouselSlide: Mock;
  upsertExternalService: Mock;
  deleteExternalService: Mock;
  upsertEvent: Mock;
  upsertMedia: Mock;
  upsertUser: Mock;
  deleteUser: Mock;
  updateDisplaySettings: Mock;
  updateHomepageSettings: Mock;
  updateSiteSettings: Mock;
  updateVisitorStats: Mock;
  verifyAuthToken: Mock;
}

type ThrowingWriteResource =
  | "content"
  | "content-delete"
  | "carousel"
  | "carousel-delete"
  | "external-service"
  | "external-service-delete"
  | "media"
  | "media-delete"
  | "event"
  | "event-delete"
  | "publish"
  | "menu"
  | "display-settings"
  | "site-settings"
  | "homepage-settings"
  | "visitor-stats"
  | "users"
  | "users-delete"
  | "users-reset";

interface LoadCodeScriptOptions {
  lockAcquired?: boolean;
  throwingWriteResource?: ThrowingWriteResource;
}

function loadCodeScript(input: LoadCodeScriptOptions = {}): CodeScriptContext {
  const maybeThrowWrite = (resource: ThrowingWriteResource) => {
    if (input.throwingWriteResource === resource) {
      throw new Error("Forced write failure.");
    }
  };
  const scriptLock = {
    tryLock: vi.fn(() => input.lockAcquired !== false),
    releaseLock: vi.fn()
  };
  const lockService = {
    getScriptLock: vi.fn(() => scriptLock)
  };
  const getUsers = vi.fn(() => [
    {
      id: "user-1",
      email: "admin@example.edu",
      role: "admin"
    }
  ]);
  const incrementContentView = vi.fn(() => ({
    id: "content-1",
    slug: "announcement-1",
    viewCount: 2,
    lastViewedAt: "2026-05-03T00:00:00.000Z"
  }));
  const upsertContent = vi.fn((content: Record<string, unknown>) => {
    maybeThrowWrite("content");
    return {
      id: content.id || "content-1",
      title: content.title || ""
    };
  });
  const deleteContent = vi.fn((id: string) => {
    maybeThrowWrite("content-delete");
    return {
      id,
      deleted: true
    };
  });
  const getPublicHomeSnapshot = vi.fn(() => ({
    latestNews: [],
    media: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicContentListSnapshot = vi.fn((query: Record<string, unknown>) => ({
    kind: query.kind || "news",
    items: [],
    media: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicProgramListSnapshot = vi.fn(() => ({
    items: [],
    media: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicSearchIndexSnapshot = vi.fn(() => ({
    items: [],
    generatedAt: "2026-05-12T00:00:00.000Z"
  }));
  const getPublicHomeSnapshotCached = vi.fn(() => getPublicHomeSnapshot());
  const getPublicContentListSnapshotCached = vi.fn((query: Record<string, unknown>) =>
    getPublicContentListSnapshot(query)
  );
  const getPublicProgramListSnapshotCached = vi.fn(() => getPublicProgramListSnapshot());
  const getPublicSearchIndexSnapshotCached = vi.fn(() => getPublicSearchIndexSnapshot());
  const getPublicContentDetailCached = vi.fn((query: Record<string, unknown>) => ({
    id: query.id || "content-1",
    slug: query.slug || "content-1",
    title: "Public content"
  }));
  const upsertCarouselSlide = vi.fn((input: Record<string, unknown>) => {
    maybeThrowWrite("carousel");
    return {
      id: input.id || "carousel-1",
      title: input.title || "",
      enabled: input.enabled === true
    };
  });
  const deleteCarouselSlide = vi.fn((id: string) => {
    maybeThrowWrite("carousel-delete");
    return {
      id,
      deleted: true
    };
  });
  const upsertExternalService = vi.fn((input: Record<string, unknown>) => {
    maybeThrowWrite("external-service");
    return {
      id: input.id || "external-service-1",
      title: input.title || "",
      enabled: input.enabled === true
    };
  });
  const deleteExternalService = vi.fn((id: string) => {
    maybeThrowWrite("external-service-delete");
    return {
      id,
      deleted: true
    };
  });
  const upsertMedia = vi.fn((asset: Record<string, unknown>) => {
    maybeThrowWrite("media");
    return {
      id: asset.id || "media-1"
    };
  });
  const deleteMedia = vi.fn((id: string) => {
    maybeThrowWrite("media-delete");
    return {
      id,
      deleted: true
    };
  });
  const upsertEvent = vi.fn((event: Record<string, unknown>) => {
    maybeThrowWrite("event");
    return {
      id: event.id || "event-1"
    };
  });
  const deleteEvent = vi.fn((id: string) => {
    maybeThrowWrite("event-delete");
    return {
      id,
      deleted: true
    };
  });
  const publishContent = vi.fn((id: string) => {
    maybeThrowWrite("publish");
    return {
      id,
      published: true
    };
  });
  const replaceMenu = vi.fn((items: Array<Record<string, unknown>>) => {
    maybeThrowWrite("menu");
    return items;
  });
  const updateDisplaySettings = vi.fn((settings: Record<string, unknown>) => {
    maybeThrowWrite("display-settings");
    return settings;
  });
  const updateSiteSettings = vi.fn((settings: Record<string, unknown>) => {
    maybeThrowWrite("site-settings");
    return settings;
  });
  const updateHomepageSettings = vi.fn((settings: Record<string, unknown>) => {
    maybeThrowWrite("homepage-settings");
    return settings;
  });
  const updateVisitorStats = vi.fn((stats: Record<string, unknown>) => {
    maybeThrowWrite("visitor-stats");
    return stats;
  });
  const upsertUser = vi.fn((user: Record<string, unknown>) => {
    maybeThrowWrite("users");
    return {
      id: user.id || "user-2",
      email: user.email || "editor@example.edu"
    };
  });
  const deleteUser = vi.fn((id: string) => {
    maybeThrowWrite("users-delete");
    return {
      id,
      deleted: true
    };
  });
  const resetUsers = vi.fn(() => {
    maybeThrowWrite("users-reset");
    return [
      {
        id: "user-admin",
        role: "admin"
      }
    ];
  });
  const verifyAuthToken = vi.fn((token: string) => {
    if (token === "admin-token") {
      return {
        user: {
          role: "admin"
        }
      };
    }

    if (token === "editor-token") {
      return {
        user: {
          role: "editor"
        }
      };
    }

    return null;
  });
  const jsonResponse = vi.fn(
    (body: Record<string, unknown>, statusCode = 200): RouteResult => ({
      body: {
        ...body,
        statusCode
      },
      statusCode
    })
  );
  const createScriptExports = new Function(
    "ensureDefaultScriptProperties",
    "getResource",
    "parsePayload",
    "getQueryParams",
    "getSetting",
    "setSetting",
    "Utilities",
    "SETTING_KEYS",
    "LockService",
    "verifyAuthToken",
    "jsonResponse",
    "getPublicSnapshotCached",
    "getPublicHomeSnapshotCached",
    "getPublicContentListSnapshotCached",
    "getPublicProgramListSnapshotCached",
    "getPublicSearchIndexSnapshotCached",
    "getSnapshot",
    "getMenu",
    "getDisplaySettings",
    "getPublicContentDetailCached",
    "getContentDetail",
    "incrementContentView",
    "loginUser",
    "upsertContent",
    "deleteContent",
    "upsertCarouselSlide",
    "deleteCarouselSlide",
    "upsertExternalService",
    "deleteExternalService",
    "upsertMedia",
    "deleteMedia",
    "upsertEvent",
    "deleteEvent",
    "publishContent",
    "replaceMenu",
    "updateDisplaySettings",
    "updateSiteSettings",
    "updateHomepageSettings",
    "updateVisitorStats",
    "getUsers",
    "upsertUser",
    "deleteUser",
    "resetUsers",
    `${locksSource}
${codeSource}
return {
  extractAuthToken,
  routeRequest,
  shouldReadAuthContext
};`
  );
  const exports = createScriptExports(
    vi.fn(),
    (event: { resource?: string; parameter?: { resource?: string } }) =>
      event.resource || event.parameter?.resource || "",
    (event: { payload?: Record<string, unknown> }) => event.payload || {},
    (event: { query?: Record<string, unknown> }) => event.query || {},
    (key: string) => (key === "authTokenSecret" ? "secret" : ""),
    vi.fn(),
    {
      getUuid: () => "test-uuid"
    },
    {
      authTokenSecret: "authTokenSecret"
    },
    lockService,
    verifyAuthToken,
    jsonResponse,
    vi.fn(() => ({
      content: []
    })),
    getPublicHomeSnapshotCached,
    getPublicContentListSnapshotCached,
    getPublicProgramListSnapshotCached,
    getPublicSearchIndexSnapshotCached,
    vi.fn(),
    vi.fn(() => []),
    vi.fn(() => ({})),
    getPublicContentDetailCached,
    vi.fn(),
    incrementContentView,
    vi.fn(),
    upsertContent,
    deleteContent,
    upsertCarouselSlide,
    deleteCarouselSlide,
    upsertExternalService,
    deleteExternalService,
    upsertMedia,
    deleteMedia,
    upsertEvent,
    deleteEvent,
    publishContent,
    replaceMenu,
    updateDisplaySettings,
    updateSiteSettings,
    updateHomepageSettings,
    updateVisitorStats,
    getUsers,
    upsertUser,
    deleteUser,
    resetUsers
  ) as Pick<CodeScriptContext, "extractAuthToken" | "routeRequest" | "shouldReadAuthContext">;

  return {
    ...exports,
    deleteContent,
    deleteEvent,
    deleteMedia,
    getPublicContentDetailCached,
    getPublicContentListSnapshotCached,
    getPublicContentListSnapshot,
    getPublicHomeSnapshotCached,
    getPublicHomeSnapshot,
    getPublicProgramListSnapshotCached,
    getPublicProgramListSnapshot,
    getPublicSearchIndexSnapshotCached,
    getPublicSearchIndexSnapshot,
    getUsers,
    incrementContentView,
    lockService,
    publishContent,
    replaceMenu,
    resetUsers,
    scriptLock,
    upsertContent,
    upsertCarouselSlide,
    deleteCarouselSlide,
    upsertExternalService,
    deleteExternalService,
    upsertEvent,
    upsertMedia,
    upsertUser,
    deleteUser,
    updateDisplaySettings,
    updateHomepageSettings,
    updateSiteSettings,
    updateVisitorStats,
    verifyAuthToken
  };
}

type LockedWriteMockName = keyof Pick<
  CodeScriptContext,
  | "deleteContent"
  | "deleteEvent"
  | "deleteMedia"
  | "deleteUser"
  | "publishContent"
  | "replaceMenu"
  | "resetUsers"
  | "upsertContent"
  | "upsertCarouselSlide"
  | "deleteCarouselSlide"
  | "upsertExternalService"
  | "deleteExternalService"
  | "upsertEvent"
  | "upsertMedia"
  | "upsertUser"
  | "updateDisplaySettings"
  | "updateHomepageSettings"
  | "updateSiteSettings"
  | "updateVisitorStats"
>;

describe("Apps Script route auth handling", () => {
  it("keeps Apps Script intro gate Thai defaults readable", () => {
    expect(configSource).toContain('imageAlt: "ภาพแนะนำ"');
    expect(configSource).toContain('primaryButtonLabel: "เข้าสู่เว็บไซต์หลัก"');
  });

  it("returns public-home through unauthenticated GET without reading auth context", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "public-home"
      },
      "GET"
    );

    expect(context.shouldReadAuthContext("GET", "public-home")).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body.latestNews).toEqual([]);
    expect(result.body.generatedAt).toBe("2026-05-12T00:00:00.000Z");
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.getPublicHomeSnapshotCached).toHaveBeenCalledWith({
      debugPerformance: false
    });
    expect(context.getPublicHomeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns public content lists through unauthenticated GET without reading auth context", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "public-content-list",
        query: {
          kind: "announcements"
        }
      },
      "GET"
    );

    expect(context.shouldReadAuthContext("GET", "public-content-list")).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body.kind).toBe("announcements");
    expect(result.body.items).toEqual([]);
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.getPublicContentListSnapshotCached).toHaveBeenCalledWith(
      {
        kind: "announcements"
      },
      {
        debugPerformance: false
      }
    );
    expect(context.getPublicContentListSnapshot).toHaveBeenCalledWith({
      kind: "announcements"
    });
  });

  it("returns public program lists through unauthenticated GET without reading auth context", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "public-program-list"
      },
      "GET"
    );

    expect(context.shouldReadAuthContext("GET", "public-program-list")).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body.items).toEqual([]);
    expect(result.body.generatedAt).toBe("2026-05-12T00:00:00.000Z");
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.getPublicProgramListSnapshotCached).toHaveBeenCalledWith({
      debugPerformance: false
    });
    expect(context.getPublicProgramListSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns public search index through unauthenticated GET without reading auth context", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "public-search-index"
      },
      "GET"
    );

    expect(context.shouldReadAuthContext("GET", "public-search-index")).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body.items).toEqual([]);
    expect(result.body.generatedAt).toBe("2026-05-12T00:00:00.000Z");
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.getPublicSearchIndexSnapshotCached).toHaveBeenCalledWith({
      debugPerformance: false
    });
    expect(context.getPublicSearchIndexSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns public content detail through the cached public wrapper", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "content-detail",
        query: {
          slug: "announcement-1"
        }
      },
      "GET"
    );

    expect(context.shouldReadAuthContext("GET", "content-detail")).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body.slug).toBe("announcement-1");
    expect(result.body.title).toBe("Public content");
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.getPublicContentDetailCached).toHaveBeenCalledWith(
      {
        slug: "announcement-1"
      },
      {
        debugPerformance: false
      }
    );
  });

  it("passes debugPerformance=1 only to public cached GET wrappers", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "public-home",
        query: {
          debugPerformance: "1"
        }
      },
      "GET"
    );

    expect(result.statusCode).toBe(200);
    expect(context.getPublicHomeSnapshotCached).toHaveBeenCalledWith({
      debugPerformance: true
    });
  });

  it("does not treat GET users as a valid authenticated route", () => {
    const context = loadCodeScript();

    expect(context.shouldReadAuthContext("GET", "users")).toBe(false);

    const result = context.routeRequest(
      {
        resource: "users",
        query: {
          authToken: "admin-token"
        }
      },
      "GET"
    );

    expect(result.statusCode).toBe(404);
    expect(result.body.error).toBe("Unknown route");
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.getUsers).not.toHaveBeenCalled();
  });

  it("acquires and releases the script lock for mutating write routes", () => {
    const writeRoutes: Array<{
      resource: string;
      payload: Record<string, unknown>;
      mockName: LockedWriteMockName;
    }> = [
      {
        resource: "content",
        payload: {
          title: "Content",
          authToken: "editor-token"
        },
        mockName: "upsertContent"
      },
      {
        resource: "content-delete",
        payload: {
          id: "content-1",
          authToken: "editor-token"
        },
        mockName: "deleteContent"
      },
      {
        resource: "publish",
        payload: {
          id: "content-1",
          authToken: "editor-token"
        },
        mockName: "publishContent"
      },
      {
        resource: "carousel",
        payload: {
          title: "Slide",
          authToken: "editor-token"
        },
        mockName: "upsertCarouselSlide"
      },
      {
        resource: "carousel-delete",
        payload: {
          id: "carousel-1",
          authToken: "editor-token"
        },
        mockName: "deleteCarouselSlide"
      },
      {
        resource: "external-service",
        payload: {
          title: "Service",
          authToken: "editor-token"
        },
        mockName: "upsertExternalService"
      },
      {
        resource: "external-service-delete",
        payload: {
          id: "external-service-1",
          authToken: "editor-token"
        },
        mockName: "deleteExternalService"
      },
      {
        resource: "media",
        payload: {
          name: "Media",
          authToken: "editor-token"
        },
        mockName: "upsertMedia"
      },
      {
        resource: "media-delete",
        payload: {
          id: "media-1",
          authToken: "editor-token"
        },
        mockName: "deleteMedia"
      },
      {
        resource: "event",
        payload: {
          title: "Event",
          authToken: "editor-token"
        },
        mockName: "upsertEvent"
      },
      {
        resource: "event-delete",
        payload: {
          id: "event-1",
          authToken: "editor-token"
        },
        mockName: "deleteEvent"
      },
      {
        resource: "menu",
        payload: {
          items: [{ id: "home" }],
          authToken: "editor-token"
        },
        mockName: "replaceMenu"
      },
      {
        resource: "display-settings",
        payload: {
          dateFormat: "D MMM BBBB",
          authToken: "editor-token"
        },
        mockName: "updateDisplaySettings"
      },
      {
        resource: "site-settings",
        payload: {
          siteName: "Updated",
          authToken: "admin-token"
        },
        mockName: "updateSiteSettings"
      },
      {
        resource: "homepage-settings",
        payload: {
          marquee: {},
          authToken: "admin-token"
        },
        mockName: "updateHomepageSettings"
      },
      {
        resource: "visitor-stats",
        payload: {
          enabled: true,
          authToken: "admin-token"
        },
        mockName: "updateVisitorStats"
      },
      {
        resource: "users",
        payload: {
          email: "editor@example.edu",
          authToken: "admin-token"
        },
        mockName: "upsertUser"
      },
      {
        resource: "users-delete",
        payload: {
          id: "user-2",
          authToken: "admin-token"
        },
        mockName: "deleteUser"
      },
      {
        resource: "users-reset",
        payload: {
          authToken: "admin-token"
        },
        mockName: "resetUsers"
      }
    ];

    writeRoutes.forEach((route) => {
      const context = loadCodeScript();
      const result = context.routeRequest(
        {
          resource: route.resource,
          payload: route.payload
        },
        "POST"
      );

      expect(result.statusCode).toBe(200);
      expect(context.lockService.getScriptLock).toHaveBeenCalledTimes(1);
      expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
      expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
      expect(context[route.mockName]).toHaveBeenCalled();
    });
  });

  it("returns 503 and skips the write when the script lock is unavailable", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadCodeScript({
      lockAcquired: false
    });
    const result = context.routeRequest(
      {
        resource: "carousel",
        payload: {
          title: "Homepage slide",
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(result.statusCode).toBe(503);
    expect(result.body.error).toBe("CMS is busy. Please retry.");
    expect(context.lockService.getScriptLock).toHaveBeenCalledTimes(1);
    expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
    expect(context.scriptLock.releaseLock).not.toHaveBeenCalled();
    expect(context.upsertCarouselSlide).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("releases the script lock when a write route throws", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadCodeScript({
      throwingWriteResource: "carousel"
    });
    const result = context.routeRequest(
      {
        resource: "carousel",
        payload: {
          title: "Homepage slide",
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(result.statusCode).toBe(500);
    expect(result.body.error).toBe("Forced write failure.");
    expect(context.upsertCarouselSlide).toHaveBeenCalledTimes(1);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });

  it("does not acquire write locks for read-only routes or content views", () => {
    const context = loadCodeScript();

    expect(
      context.routeRequest(
        {
          resource: "public-home"
        },
        "GET"
      ).statusCode
    ).toBe(200);
    expect(
      context.routeRequest(
        {
          resource: "snapshot-admin",
          payload: {
            authToken: "editor-token"
          }
        },
        "POST"
      ).statusCode
    ).toBe(200);
    expect(
      context.routeRequest(
        {
          resource: "users",
          payload: {
            action: "list",
            authToken: "admin-token"
          }
        },
        "POST"
      ).statusCode
    ).toBe(200);
    expect(
      context.routeRequest(
        {
          resource: "content-view",
          payload: {
            slug: "announcement-1"
          }
        },
        "POST"
      ).statusCode
    ).toBe(200);

    expect(context.lockService.getScriptLock).not.toHaveBeenCalled();
    expect(context.incrementContentView).toHaveBeenCalledTimes(1);
  });

  it("lists users through POST users action=list only for admin tokens", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adminContext = loadCodeScript();
    const adminResult = adminContext.routeRequest(
      {
        resource: "users",
        payload: {
          action: "list",
          authToken: "admin-token"
        }
      },
      "POST"
    );

    expect(adminResult.statusCode).toBe(200);
    expect(adminResult.body.items).toEqual([
      {
        id: "user-1",
        email: "admin@example.edu",
        role: "admin"
      }
    ]);
    expect(adminContext.verifyAuthToken).toHaveBeenCalledWith("admin-token");
    expect(adminContext.getUsers).toHaveBeenCalledTimes(1);

    const editorContext = loadCodeScript();
    const editorResult = editorContext.routeRequest(
      {
        resource: "users",
        payload: {
          action: "list",
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(editorResult.statusCode).toBe(403);
    expect(editorResult.body.error).toBe("You do not have permission for this action.");
    expect(editorContext.getUsers).not.toHaveBeenCalled();

    const anonymousContext = loadCodeScript();
    const anonymousResult = anonymousContext.routeRequest(
      {
        resource: "users",
        payload: {
          action: "list"
        }
      },
      "POST"
    );

    expect(anonymousResult.statusCode).toBe(401);
    expect(anonymousResult.body.error).toBe("Authentication is required.");
    expect(anonymousContext.getUsers).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("updates site settings only for admin tokens", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adminContext = loadCodeScript();
    const adminResult = adminContext.routeRequest(
      {
        resource: "site-settings",
        payload: {
          siteName: "Updated site",
          authToken: "admin-token"
        }
      },
      "POST"
    );

    expect(adminResult.statusCode).toBe(200);
    expect(adminResult.body.siteName).toBe("Updated site");
    expect(adminContext.updateSiteSettings).toHaveBeenCalledWith({
      siteName: "Updated site",
      authToken: "admin-token"
    });

    const editorContext = loadCodeScript();
    const editorResult = editorContext.routeRequest(
      {
        resource: "site-settings",
        payload: {
          siteName: "Editor update",
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(editorResult.statusCode).toBe(403);
    expect(editorContext.updateSiteSettings).not.toHaveBeenCalled();
    expect(editorContext.lockService.getScriptLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("updates homepage settings only for admin tokens", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adminContext = loadCodeScript();
    const adminResult = adminContext.routeRequest(
      {
        resource: "homepage-settings",
        payload: {
          marquee: {
            enabled: true,
            text: "Updated marquee"
          },
          authToken: "admin-token"
        }
      },
      "POST"
    );

    expect(adminResult.statusCode).toBe(200);
    expect(adminResult.body.marquee).toEqual({
      enabled: true,
      text: "Updated marquee"
    });
    expect(adminContext.updateHomepageSettings).toHaveBeenCalledWith({
      marquee: {
        enabled: true,
        text: "Updated marquee"
      },
      authToken: "admin-token"
    });

    const editorContext = loadCodeScript();
    const editorResult = editorContext.routeRequest(
      {
        resource: "homepage-settings",
        payload: {
          marquee: {
            enabled: true,
            text: "Editor update"
          },
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(editorResult.statusCode).toBe(403);
    expect(editorContext.updateHomepageSettings).not.toHaveBeenCalled();
    expect(editorContext.lockService.getScriptLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("updates visitor stats only for admin tokens", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const adminContext = loadCodeScript();
    const adminResult = adminContext.routeRequest(
      {
        resource: "visitor-stats",
        payload: {
          enabled: true,
          usersToday: 12,
          authToken: "admin-token"
        }
      },
      "POST"
    );

    expect(adminResult.statusCode).toBe(200);
    expect(adminResult.body.enabled).toBe(true);
    expect(adminResult.body.usersToday).toBe(12);
    expect(adminContext.updateVisitorStats).toHaveBeenCalledWith({
      enabled: true,
      usersToday: 12,
      authToken: "admin-token"
    });

    const editorContext = loadCodeScript();
    const editorResult = editorContext.routeRequest(
      {
        resource: "visitor-stats",
        payload: {
          enabled: true,
          usersToday: 3,
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(editorResult.statusCode).toBe(403);
    expect(editorContext.updateVisitorStats).not.toHaveBeenCalled();
    expect(editorContext.lockService.getScriptLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("allows editors to upsert and delete carousel slides", () => {
    const context = loadCodeScript();
    const saveResult = context.routeRequest(
      {
        resource: "carousel",
        payload: {
          id: "carousel-1",
          title: "Homepage slide",
          enabled: true,
          authToken: "editor-token"
        }
      },
      "POST"
    );
    const deleteResult = context.routeRequest(
      {
        resource: "carousel-delete",
        payload: {
          id: "carousel-1",
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(saveResult.statusCode).toBe(200);
    expect(saveResult.body).toMatchObject({
      id: "carousel-1",
      title: "Homepage slide",
      enabled: true
    });
    expect(deleteResult.statusCode).toBe(200);
    expect(deleteResult.body).toMatchObject({
      id: "carousel-1",
      deleted: true
    });
    expect(context.upsertCarouselSlide).toHaveBeenCalledWith({
      id: "carousel-1",
      title: "Homepage slide",
      enabled: true,
      authToken: "editor-token"
    });
    expect(context.deleteCarouselSlide).toHaveBeenCalledWith("carousel-1");
  });

  it("blocks unauthenticated carousel writes", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "carousel",
        payload: {
          title: "Homepage slide"
        }
      },
      "POST"
    );

    expect(result.statusCode).toBe(401);
    expect(result.body.error).toBe("Authentication is required.");
    expect(context.upsertCarouselSlide).not.toHaveBeenCalled();
    expect(context.lockService.getScriptLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("allows editors to upsert and delete external services", () => {
    const context = loadCodeScript();
    const saveResult = context.routeRequest(
      {
        resource: "external-service",
        payload: {
          id: "external-service-1",
          title: "Student portal",
          enabled: true,
          authToken: "editor-token"
        }
      },
      "POST"
    );
    const deleteResult = context.routeRequest(
      {
        resource: "external-service-delete",
        payload: {
          id: "external-service-1",
          authToken: "editor-token"
        }
      },
      "POST"
    );

    expect(saveResult.statusCode).toBe(200);
    expect(saveResult.body).toMatchObject({
      id: "external-service-1",
      title: "Student portal",
      enabled: true
    });
    expect(deleteResult.statusCode).toBe(200);
    expect(deleteResult.body).toMatchObject({
      id: "external-service-1",
      deleted: true
    });
    expect(context.upsertExternalService).toHaveBeenCalledWith({
      id: "external-service-1",
      title: "Student portal",
      enabled: true,
      authToken: "editor-token"
    });
    expect(context.deleteExternalService).toHaveBeenCalledWith("external-service-1");
  });

  it("blocks unauthenticated external service writes", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "external-service",
        payload: {
          title: "Student portal"
        }
      },
      "POST"
    );

    expect(result.statusCode).toBe(401);
    expect(result.body.error).toBe("Authentication is required.");
    expect(context.upsertExternalService).not.toHaveBeenCalled();
    expect(context.lockService.getScriptLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("records public content views without authentication", () => {
    const context = loadCodeScript();
    const result = context.routeRequest(
      {
        resource: "content-view",
        payload: {
          slug: "announcement-1"
        }
      },
      "POST"
    );

    expect(context.shouldReadAuthContext("POST", "content-view")).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.body.viewCount).toBe(2);
    expect(context.verifyAuthToken).not.toHaveBeenCalled();
    expect(context.incrementContentView).toHaveBeenCalledWith({
      slug: "announcement-1"
    });
    expect(context.lockService.getScriptLock).not.toHaveBeenCalled();
  });

  it("never reads authToken from query parameters", () => {
    const context = loadCodeScript();

    expect(context.extractAuthToken({}, { authToken: "query-token" })).toBe("");
    expect(context.extractAuthToken({ authToken: "" }, { authToken: "query-token" })).toBe("");
    expect(context.extractAuthToken({ authToken: "body-token" }, { authToken: "query-token" })).toBe("body-token");
  });

  it("does not read auth context for any GET resource", () => {
    const context = loadCodeScript();
    const getResources = [
      "",
      "snapshot",
      "public-home",
      "public-content-list",
      "public-program-list",
      "public-search-index",
      "health",
      "menu",
      "display-settings",
      "content-detail",
      "users",
      "users-delete",
      "snapshot-admin",
      "content-view",
      "any-future-admin-route"
    ];

    getResources.forEach((resource) => {
      expect(context.shouldReadAuthContext("GET", resource)).toBe(false);
    });
  });
});
