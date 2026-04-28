import { describe, expect, it, vi, type Mock } from "vitest";
import codeSource from "../../apps-script/Code.gs?raw";

interface RouteResult {
  body: Record<string, unknown>;
  statusCode: number;
}

interface CodeScriptContext {
  extractAuthToken: (payload: Record<string, unknown>, query?: Record<string, unknown>) => string;
  getUsers: Mock;
  routeRequest: (event: Record<string, unknown>, method: string) => RouteResult;
  shouldReadAuthContext: (method: string, resource: string) => boolean;
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
  const jsonResponse = vi.fn((body: Record<string, unknown>, statusCode = 200): RouteResult => ({
    body: {
      ...body,
      statusCode
    },
    statusCode
  }));
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
    "getSnapshot",
    "getMenu",
    "getDisplaySettings",
    "getContentDetail",
    "loginUser",
    "upsertContent",
    "deleteContent",
    "upsertMedia",
    "deleteMedia",
    "upsertEvent",
    "deleteEvent",
    "publishContent",
    "replaceMenu",
    "updateDisplaySettings",
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
    (event: { resource?: string; parameter?: { resource?: string } }) => event.resource || event.parameter?.resource || "",
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
    vi.fn(),
    vi.fn(() => []),
    vi.fn(() => ({})),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    getUsers,
    vi.fn(),
    vi.fn(),
    vi.fn()
  ) as Pick<CodeScriptContext, "extractAuthToken" | "routeRequest" | "shouldReadAuthContext">;

  return {
    ...exports,
    getUsers,
    verifyAuthToken
  };
}

describe("Apps Script route auth handling", () => {
  it("returns unknown route for legacy GET users and does not read query authToken", () => {
    const context = loadCodeScript();

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

  it("does not read authToken from query parameters for any GET resource", () => {
    const context = loadCodeScript();
    const getResources = [
      "snapshot",
      "health",
      "menu",
      "display-settings",
      "content-detail",
      "users",
      "users-delete",
      "snapshot-admin"
    ];

    getResources.forEach((resource) => {
      expect(context.shouldReadAuthContext("GET", resource)).toBe(false);
    });

    expect(context.extractAuthToken({}, { authToken: "query-token" })).toBe("");
  });
});
