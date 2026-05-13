import { describe, expect, it, vi, type Mock } from "vitest";
import codeSource from "../../apps-script/Code.gs?raw";

interface RouteResult {
  body: Record<string, unknown>;
  statusCode: number;
}

interface CodeScriptContext {
  extractAuthToken: (payload: Record<string, unknown>, query?: Record<string, unknown>) => string;
  getPublicContentListSnapshot: Mock;
  getPublicHomeSnapshot: Mock;
  getPublicProgramListSnapshot: Mock;
  getPublicSearchIndexSnapshot: Mock;
  getUsers: Mock;
  incrementContentView: Mock;
  routeRequest: (event: Record<string, unknown>, method: string) => RouteResult;
  shouldReadAuthContext: (method: string, resource: string) => boolean;
  upsertCarouselSlide: Mock;
  deleteCarouselSlide: Mock;
  upsertExternalService: Mock;
  deleteExternalService: Mock;
  updateHomepageSettings: Mock;
  updateSiteSettings: Mock;
  updateVisitorStats: Mock;
  verifyAuthToken: Mock;
}

function loadCodeScript(): CodeScriptContext {
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
  const upsertCarouselSlide = vi.fn((input: Record<string, unknown>) => ({
    id: input.id || "carousel-1",
    title: input.title || "",
    enabled: input.enabled === true
  }));
  const deleteCarouselSlide = vi.fn((id: string) => ({
    id,
    deleted: true
  }));
  const upsertExternalService = vi.fn((input: Record<string, unknown>) => ({
    id: input.id || "external-service-1",
    title: input.title || "",
    enabled: input.enabled === true
  }));
  const deleteExternalService = vi.fn((id: string) => ({
    id,
    deleted: true
  }));
  const updateSiteSettings = vi.fn((input: Record<string, unknown>) => input);
  const updateHomepageSettings = vi.fn((input: Record<string, unknown>) => input);
  const updateVisitorStats = vi.fn((input: Record<string, unknown>) => input);
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
    "verifyAuthToken",
    "jsonResponse",
    "getPublicSnapshotCached",
    "getPublicHomeSnapshot",
    "getPublicContentListSnapshot",
    "getPublicProgramListSnapshot",
    "getPublicSearchIndexSnapshot",
    "getSnapshot",
    "getMenu",
    "getDisplaySettings",
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
    `${codeSource}
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
    verifyAuthToken,
    jsonResponse,
    vi.fn(() => ({
      content: []
    })),
    getPublicHomeSnapshot,
    getPublicContentListSnapshot,
    getPublicProgramListSnapshot,
    getPublicSearchIndexSnapshot,
    vi.fn(),
    vi.fn(() => []),
    vi.fn(() => ({})),
    vi.fn(),
    incrementContentView,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    upsertCarouselSlide,
    deleteCarouselSlide,
    upsertExternalService,
    deleteExternalService,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    updateSiteSettings,
    updateHomepageSettings,
    updateVisitorStats,
    getUsers,
    vi.fn(),
    vi.fn(),
    vi.fn()
  ) as Pick<CodeScriptContext, "extractAuthToken" | "routeRequest" | "shouldReadAuthContext">;

  return {
    ...exports,
    getPublicContentListSnapshot,
    getPublicHomeSnapshot,
    getPublicProgramListSnapshot,
    getPublicSearchIndexSnapshot,
    getUsers,
    incrementContentView,
    upsertCarouselSlide,
    deleteCarouselSlide,
    upsertExternalService,
    deleteExternalService,
    updateHomepageSettings,
    updateSiteSettings,
    updateVisitorStats,
    verifyAuthToken
  };
}

describe("Apps Script route auth handling", () => {
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
    expect(context.getPublicSearchIndexSnapshot).toHaveBeenCalledTimes(1);
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
