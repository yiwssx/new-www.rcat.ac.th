import { describe, expect, it, vi, type Mock } from "vitest";
import codeSource from "../../apps-script/Code.gs?raw";
import configSource from "../../apps-script/Config.gs?raw";
import httpUtilsSource from "../../apps-script/HttpUtils.gs?raw";
import locksSource from "../../apps-script/Locks.gs?raw";
import scriptPropertiesSource from "../../apps-script/ScriptProperties.gs?raw";
import storageSource from "../../apps-script/Storage.gs?raw";
import cmsSource from "../../apps-script/Cms.gs?raw";

interface AppsScriptTextOutput {
  content: string;
  mimeType: string;
  setMimeType: (mimeType: string) => AppsScriptTextOutput;
}

interface AppsScriptRouteResult {
  body: Record<string, unknown>;
  statusCode: number;
}

interface AppsScriptBridgeContext {
  doGet: (event: Record<string, unknown>) => AppsScriptTextOutput;
  doPost: (event: Record<string, unknown>) => AppsScriptTextOutput;
  driveApp: {
    getFileById: Mock;
    getFolderById: Mock;
  };
  mediaFolder: {
    createFile: Mock;
  };
  scriptLock: {
    tryLock: Mock;
    releaseLock: Mock;
  };
}

function parseResult(output: AppsScriptTextOutput): AppsScriptRouteResult {
  const body = JSON.parse(output.content) as Record<string, unknown>;
  return {
    body,
    statusCode: Number(body.statusCode)
  };
}

function postEvent(resource: string, payload: Record<string, unknown>) {
  return {
    parameter: {
      resource
    },
    postData: {
      contents: JSON.stringify(payload)
    }
  };
}

function getEvent(resource?: string) {
  return {
    parameter: resource
      ? {
          resource
        }
      : {}
  };
}

function createIterator<T>(items: T[]) {
  let index = 0;

  return {
    hasNext: () => index < items.length,
    next: () => items[index++]
  };
}

function loadAppsScriptBridge(
  input: { bridgeToken?: string; mediaBridgeToken?: string } = {}
): AppsScriptBridgeContext {
  const properties = new Map<string, string>([
    ["APPS_SCRIPT_BRIDGE_TOKEN", input.bridgeToken ?? "server-media-token"],
    ["MEDIA_BRIDGE_TOKEN", input.mediaBridgeToken ?? ""],
    ["driveFolderId", "media-folder-id"],
    ["rootFolderName", "RCAT_BACKEND_DATABASE"],
    ["mediaFolderName", "RCAT_MEDIA_STUFF"]
  ]);
  const scriptProperties = {
    getProperty: vi.fn((key: string) => properties.get(key) ?? null),
    setProperty: vi.fn((key: string, value: string) => {
      properties.set(key, value);
    })
  };
  const scriptLock = {
    tryLock: vi.fn(() => true),
    releaseLock: vi.fn()
  };
  const uploadedFile = {
    getUrl: vi.fn(() => "https://drive.google.com/file/d/drive-file-1/view"),
    getId: vi.fn(() => "drive-file-1"),
    getMimeType: vi.fn(() => "image/jpeg"),
    getSize: vi.fn(() => 1536),
    setSharing: vi.fn()
  };
  const mediaFolder = {
    getId: vi.fn(() => "media-folder-id"),
    getName: vi.fn(() => "RCAT_MEDIA_STUFF"),
    getParents: vi.fn(() => createIterator([{ getId: () => "root-folder-id" }])),
    getFoldersByName: vi.fn(() => createIterator([])),
    createFolder: vi.fn(),
    createFile: vi.fn(() => uploadedFile)
  };
  const trashedFile = {
    setTrashed: vi.fn()
  };
  const driveApp = {
    Access: {
      ANYONE_WITH_LINK: "ANYONE_WITH_LINK"
    },
    Permission: {
      VIEW: "VIEW"
    },
    getFolderById: vi.fn(() => mediaFolder),
    getFoldersByName: vi.fn(() => createIterator([])),
    createFolder: vi.fn(() => mediaFolder),
    getFileById: vi.fn(() => trashedFile)
  };
  const contentService = {
    MimeType: {
      JSON: "application/json"
    },
    createTextOutput: vi.fn((content: string) => {
      const output: AppsScriptTextOutput = {
        content,
        mimeType: "",
        setMimeType(mimeType: string) {
          output.mimeType = mimeType;
          return output;
        }
      };
      return output;
    })
  };
  const utilities = {
    base64Decode: vi.fn(() => new Array(1536).fill(1)),
    newBlob: vi.fn((bytes: number[], contentType: string, fileName: string) => ({
      bytes,
      contentType,
      fileName
    }))
  };
  const createScriptExports = new Function(
    "console",
    "PropertiesService",
    "ContentService",
    "Utilities",
    "DriveApp",
    "LockService",
    `${configSource}
${scriptPropertiesSource}
${httpUtilsSource}
${locksSource}
${storageSource}
${cmsSource}
${codeSource}
return {
  doGet,
  doPost
};`
  );
  const exports = createScriptExports(
    console,
    {
      getScriptProperties: vi.fn(() => scriptProperties)
    },
    contentService,
    utilities,
    driveApp,
    {
      getScriptLock: vi.fn(() => scriptLock)
    }
  ) as Pick<AppsScriptBridgeContext, "doGet" | "doPost">;

  return {
    ...exports,
    driveApp,
    mediaFolder,
    scriptLock
  };
}

describe("Apps Script media bridge", () => {
  it("accepts media uploads with a valid bridge token and returns normalized Drive metadata", () => {
    const context = loadAppsScriptBridge();

    const result = parseResult(
      context.doPost(
        postEvent("media", {
          appsScriptBridgeToken: "server-media-token",
          mediaBridgeToken: "browser-token",
          name: "Original photo",
          type: "image",
          owner: "editor",
          fileName: "original-photo.jpg",
          fileBase64: "data:image/jpeg;base64,AAECAwQ=",
          mimeType: "image/jpeg"
        })
      )
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      id: "drive-file-1",
      name: "Original photo",
      type: "image",
      owner: "editor",
      driveUrl: "https://drive.google.com/file/d/drive-file-1/view",
      fileId: "drive-file-1",
      mimeType: "image/jpeg",
      thumbnailUrl: "https://drive.google.com/thumbnail?id=drive-file-1&sz=w1200",
      previewUrl: "https://drive.google.com/thumbnail?id=drive-file-1&sz=w1200",
      embedUrl: "https://drive.google.com/file/d/drive-file-1/preview"
    });
    expect(result.body).not.toHaveProperty("appsScriptBridgeToken");
    expect(result.body).not.toHaveProperty("mediaBridgeToken");
    expect(context.mediaFolder.createFile).toHaveBeenCalledTimes(1);
    expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
  });

  it("accepts media-delete with a valid bridge token and trashes the Drive file id", () => {
    const context = loadAppsScriptBridge();

    const result = parseResult(
      context.doPost(
        postEvent("media-delete", {
          appsScriptBridgeToken: "server-media-token",
          id: "media-legacy-id",
          fileId: "drive-file-1",
          deleteDriveFile: true
        })
      )
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      id: "media-legacy-id",
      deleted: true
    });
    expect(context.driveApp.getFileById).toHaveBeenCalledWith("drive-file-1");
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
  });

  it("rejects media writes with an invalid bridge token", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();

    const result = parseResult(
      context.doPost(
        postEvent("media", {
          appsScriptBridgeToken: "wrong-token",
          name: "Original photo",
          type: "image",
          owner: "editor"
        })
      )
    );

    expect(result.statusCode).toBe(401);
    expect(result.body.error).toBe("Apps Script media bridge token is invalid or missing.");
    expect(context.mediaFolder.createFile).not.toHaveBeenCalled();
    expect(context.scriptLock.tryLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("rejects structured CMS resources instead of serving legacy Apps Script data", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();

    const getResults = ["snapshot", "public-home"].map((resource) => parseResult(context.doGet(getEvent(resource))));
    const postResults = ["content", "users"].map((resource) =>
      parseResult(
        context.doPost(
          postEvent(resource, {
            appsScriptBridgeToken: "server-media-token",
            id: `${resource}-1`
          })
        )
      )
    );

    [...getResults, ...postResults].forEach((result) => {
      expect(result.statusCode).toBe(404);
      expect(result.body.error).toBe("Unknown Apps Script media bridge route.");
    });
    expect(context.mediaFolder.createFile).not.toHaveBeenCalled();
    expect(context.scriptLock.tryLock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
