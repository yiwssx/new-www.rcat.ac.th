import { Buffer } from "node:buffer";
import { describe, expect, it, vi, type Mock } from "vitest";
import codeSource from "../../apps-script/Code.gs?raw";
import configSource from "../../apps-script/Config.gs?raw";
import httpUtilsSource from "../../apps-script/HttpUtils.gs?raw";
import locksSource from "../../apps-script/Locks.gs?raw";
import scriptPropertiesSource from "../../apps-script/ScriptProperties.gs?raw";
import storageSource from "../../apps-script/Storage.gs?raw";
import cmsSource from "../../apps-script/Cms.gs?raw";
import manifestSource from "../../apps-script/appsscript.json?raw";

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
  uploadedFile: {
    setSharing: Mock;
    setTrashed: Mock;
  };
  urlFetchApp: {
    fetch: Mock;
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

function createUrlFetchResponse(statusCode: number, content = "{}", headers: Record<string, string> = {}) {
  return {
    getResponseCode: vi.fn(() => statusCode),
    getContentText: vi.fn(() => content),
    getAllHeaders: vi.fn(() => headers),
    getHeaders: vi.fn(() => headers)
  };
}

function loadAppsScriptBridge(
  input: { bridgeToken?: string; mediaBridgeToken?: string; uploadedMimeType?: string } = {}
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
    getMimeType: vi.fn(() => input.uploadedMimeType ?? "image/jpeg"),
    getSize: vi.fn(() => 1536),
    setSharing: vi.fn(),
    setTrashed: vi.fn()
  };
  const mediaFolder = {
    getId: vi.fn(() => "media-folder-id"),
    getName: vi.fn(() => "RCAT_MEDIA_STUFF"),
    getParents: vi.fn(() => createIterator([{ getId: () => "root-folder-id" }])),
    getFoldersByName: vi.fn(() => createIterator([])),
    createFolder: vi.fn(),
    createFile: vi.fn(() => uploadedFile)
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
    getFileById: vi.fn(() => uploadedFile)
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
    base64Decode: vi.fn((value: string) => Array.from(Buffer.from(value, "base64"))),
    newBlob: vi.fn((bytes: number[], contentType: string, fileName: string) => ({
      bytes,
      contentType,
      fileName
    }))
  };
  const urlFetchApp = {
    fetch: vi.fn((_url: string, options: { method?: string }) => {
      if (options.method === "post") {
        return createUrlFetchResponse(200, "{}", {
          Location:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-upload-session"
        });
      }

      return createUrlFetchResponse(200, JSON.stringify({ id: "drive-file-1" }));
    })
  };
  const createScriptExports = new Function(
    "console",
    "PropertiesService",
    "ContentService",
    "Utilities",
    "DriveApp",
    "LockService",
    "ScriptApp",
    "UrlFetchApp",
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
    },
    {
      getOAuthToken: vi.fn(() => "fake-oauth-token")
    },
    urlFetchApp
  ) as Pick<AppsScriptBridgeContext, "doGet" | "doPost">;

  return {
    ...exports,
    driveApp,
    mediaFolder,
    scriptLock,
    uploadedFile,
    urlFetchApp
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

  it("starts a Drive resumable upload under the script lock without receiving file Base64", () => {
    const context = loadAppsScriptBridge();

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-start", {
          appsScriptBridgeToken: "server-media-token",
          name: "Annual report",
          type: "document",
          owner: "editor",
          fileName: "annual-report.pdf",
          mimeType: "application/pdf",
          totalBytes: 4_000_000
        })
      )
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      totalBytes: 4_000_000,
      chunkSizeBytes: 6 * 256 * 1024,
      mediaType: "document"
    });
    expect(result.body.uploadUrl).toContain("uploadType=resumable");
    const [url, options] = context.urlFetchApp.fetch.mock.calls[0];
    expect(url).toBe("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable");
    expect(options).toMatchObject({
      method: "post",
      headers: {
        "X-Upload-Content-Length": "4000000",
        "X-Upload-Content-Type": "application/pdf"
      },
      muteHttpExceptions: true,
      followRedirects: false
    });
    expect(JSON.parse(options.payload)).toEqual({
      name: "annual-report.pdf",
      parents: ["media-folder-id"]
    });
    expect(options.payload).not.toContain("fake-oauth-token");
    expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
  });

  it("uploads a final PDF chunk without a global lock and returns preview metadata", () => {
    const context = loadAppsScriptBridge({ uploadedMimeType: "application/pdf" });
    const uploadUrl =
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-upload-session";

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          appsScriptBridgeToken: "server-media-token",
          name: "Annual report",
          type: "document",
          owner: "editor",
          fileName: "annual-report.pdf",
          mimeType: "application/pdf",
          totalBytes: 2,
          uploadUrl,
          chunkBase64: "AQI=",
          startByte: 0,
          endByte: 1
        })
      )
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      uploadComplete: true,
      asset: {
        id: "drive-file-1",
        type: "document",
        mimeType: "application/pdf",
        thumbnailUrl: "",
        previewUrl: "https://drive.google.com/file/d/drive-file-1/preview",
        embedUrl: "https://drive.google.com/file/d/drive-file-1/preview"
      }
    });
    expect(JSON.stringify(result.body)).not.toContain("test-upload-session");
    expect(JSON.stringify(result.body)).not.toContain("fake-oauth-token");
    expect(context.uploadedFile.setSharing).toHaveBeenCalledWith("ANYONE_WITH_LINK", "VIEW");
    expect(context.scriptLock.tryLock).not.toHaveBeenCalled();
    const [, options] = context.urlFetchApp.fetch.mock.calls[0];
    expect(options).toMatchObject({
      method: "put",
      headers: { "Content-Range": "bytes 0-1/2" },
      muteHttpExceptions: true,
      followRedirects: false
    });
  });

  it("returns the next Drive byte for a valid non-final 308 response", () => {
    const context = loadAppsScriptBridge();
    const chunkBytes = 256 * 1024;
    context.urlFetchApp.fetch.mockReturnValueOnce(
      createUrlFetchResponse(308, "", { Range: `bytes=0-${chunkBytes - 1}` })
    );

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          appsScriptBridgeToken: "server-media-token",
          name: "Large image",
          type: "image",
          owner: "editor",
          fileName: "large.jpg",
          mimeType: "image/jpeg",
          totalBytes: chunkBytes + 1,
          uploadUrl:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-upload-session",
          chunkBase64: Buffer.alloc(chunkBytes, 1).toString("base64"),
          startByte: 0,
          endByte: chunkBytes - 1
        })
      )
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ uploadComplete: false, nextByte: chunkBytes });
    expect(context.driveApp.getFileById).not.toHaveBeenCalled();
    expect(context.scriptLock.tryLock).not.toHaveBeenCalled();
  });

  it("rejects unsafe upload session URLs and inconsistent chunk ranges before Drive fetch", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    const basePayload = {
      appsScriptBridgeToken: "server-media-token",
      name: "Document",
      type: "document",
      owner: "editor",
      fileName: "document.pdf",
      mimeType: "application/pdf",
      totalBytes: 2,
      chunkBase64: "AQI=",
      startByte: 0,
      endByte: 1
    };

    const unsafeResult = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          ...basePayload,
          uploadUrl: "https://evil.example/upload/drive/v3/files?uploadType=resumable&upload_id=secret"
        })
      )
    );
    const rangeResult = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          ...basePayload,
          uploadUrl:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-upload-session",
          endByte: 0
        })
      )
    );

    expect(unsafeResult).toMatchObject({ statusCode: 400, body: { error: "Invalid Drive upload session." } });
    expect(rangeResult).toMatchObject({
      statusCode: 400,
      body: { error: "Upload chunk size does not match its range." }
    });
    expect(context.urlFetchApp.fetch).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("returns a safe expired-session error for Drive 410", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    context.urlFetchApp.fetch.mockReturnValueOnce(createUrlFetchResponse(410));

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          appsScriptBridgeToken: "server-media-token",
          name: "Document",
          type: "document",
          owner: "editor",
          fileName: "document.pdf",
          mimeType: "application/pdf",
          totalBytes: 2,
          uploadUrl:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-upload-session",
          chunkBase64: "AQI=",
          startByte: 0,
          endByte: 1
        })
      )
    );

    expect(result.statusCode).toBe(410);
    expect(result.body.error).toBe("Media upload session expired. Please select the file again.");
    expect(JSON.stringify(result.body)).not.toContain("test-upload-session");
    consoleErrorSpy.mockRestore();
  });

  it("redacts upload sessions and OAuth credentials from unexpected error responses and logs", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=private-session";
    context.urlFetchApp.fetch.mockImplementationOnce(() => {
      throw new Error(`request failed for ${uploadUrl} bearer private-oauth-token`);
    });

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          appsScriptBridgeToken: "server-media-token",
          name: "Document",
          type: "document",
          owner: "editor",
          fileName: "document.pdf",
          mimeType: "application/pdf",
          totalBytes: 2,
          uploadUrl,
          chunkBase64: "AQI=",
          startByte: 0,
          endByte: 1
        })
      )
    );

    expect(result).toMatchObject({ statusCode: 500, body: { error: "Media bridge request failed." } });
    const logged = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(logged).not.toContain("private-session");
    expect(logged).not.toContain("private-oauth-token");
    expect(JSON.stringify(result.body)).not.toContain("private-session");
    consoleErrorSpy.mockRestore();
  });

  it("declares only the Drive and external request OAuth scopes required by the media bridge", () => {
    const manifest = JSON.parse(manifestSource) as { oauthScopes: string[] };

    expect(manifest.oauthScopes).toEqual([
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/script.external_request"
    ]);
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
