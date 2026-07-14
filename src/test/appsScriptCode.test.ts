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

const TEST_UPLOAD_KEY = "test-upload-key-0001";
const TEST_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-upload-session";

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
      if (options.method === "get") {
        return createUrlFetchResponse(200, JSON.stringify({ files: [] }));
      }
      if (options.method === "post") {
        return createUrlFetchResponse(200, "{}", {
          Location: TEST_UPLOAD_URL
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

function resumablePayload(overrides: Record<string, unknown> = {}) {
  return {
    appsScriptBridgeToken: "server-media-token",
    name: "Annual report",
    type: "document",
    owner: "editor",
    fileName: "annual-report.pdf",
    mimeType: "application/pdf",
    totalBytes: 2,
    uploadKey: TEST_UPLOAD_KEY,
    ...overrides
  };
}

function emptyDriveLookupResponse() {
  return createUrlFetchResponse(200, JSON.stringify({ files: [] }));
}

function completedDriveLookupResponse(fileId = "drive-file-1") {
  return createUrlFetchResponse(
    200,
    JSON.stringify({
      files: [
        {
          id: fileId,
          name: "annual-report.pdf",
          mimeType: "application/pdf",
          size: "1536",
          webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
          createdTime: "2026-07-14T00:00:00.000Z"
        }
      ]
    })
  );
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
      context.doPost(postEvent("media-upload-start", resumablePayload({ totalBytes: 4_000_000 })))
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      uploadComplete: false,
      totalBytes: 4_000_000,
      chunkSizeBytes: 6 * 256 * 1024,
      nextByte: 0
    });
    expect(result.body.uploadUrl).toContain("uploadType=resumable");
    const [lookupUrl, lookupOptions] = context.urlFetchApp.fetch.mock.calls[0];
    expect(lookupOptions.method).toBe("get");
    const decodedLookupUrl = decodeURIComponent(String(lookupUrl));
    expect(decodedLookupUrl).toContain("'media-folder-id' in parents");
    expect(decodedLookupUrl).toContain("trashed = false");
    expect(decodedLookupUrl).toContain("key='rcatUploadKey'");
    expect(decodedLookupUrl).toContain(`value='${TEST_UPLOAD_KEY}'`);

    const [url, options] = context.urlFetchApp.fetch.mock.calls[1];
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
      parents: ["media-folder-id"],
      appProperties: { rcatUploadKey: TEST_UPLOAD_KEY }
    });
    expect(options.payload).not.toContain("fake-oauth-token");
    expect(context.scriptLock.tryLock).toHaveBeenCalledWith(5000);
    expect(context.scriptLock.releaseLock).toHaveBeenCalledTimes(1);
  });

  it("returns an existing completed file for the same upload key without starting another session", () => {
    const context = loadAppsScriptBridge({ uploadedMimeType: "application/pdf" });
    context.urlFetchApp.fetch.mockReturnValueOnce(completedDriveLookupResponse());

    const result = parseResult(
      context.doPost(postEvent("media-upload-start", resumablePayload({ totalBytes: 4_000_000 })))
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({
      uploadComplete: true,
      asset: {
        id: "drive-file-1",
        type: "document",
        previewUrl: "https://drive.google.com/file/d/drive-file-1/preview"
      }
    });
    expect(context.urlFetchApp.fetch).toHaveBeenCalledTimes(1);
    expect(context.urlFetchApp.fetch.mock.calls[0][1].method).toBe("get");
    expect(context.uploadedFile.setSharing).toHaveBeenCalledWith("ANYONE_WITH_LINK", "VIEW");
  });

  it("rejects invalid upload keys, MIME types, and files over 10 MB before Drive fetch", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();

    const invalidKey = parseResult(
      context.doPost(postEvent("media-upload-start", resumablePayload({ uploadKey: "short" })))
    );
    const invalidMime = parseResult(
      context.doPost(postEvent("media-upload-start", resumablePayload({ mimeType: "application/x-executable" })))
    );
    const overLimit = parseResult(
      context.doPost(postEvent("media-upload-start", resumablePayload({ totalBytes: 10 * 1024 * 1024 + 1 })))
    );

    expect(invalidKey).toMatchObject({ statusCode: 400, body: { error: "Invalid media upload key." } });
    expect(invalidMime).toMatchObject({ statusCode: 400, body: { error: "Unsupported file type." } });
    expect(overLimit.statusCode).toBe(413);
    expect(context.urlFetchApp.fetch).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("uploads a final PDF chunk without a global lock and returns preview metadata", () => {
    const context = loadAppsScriptBridge({ uploadedMimeType: "application/pdf" });
    const uploadUrl = TEST_UPLOAD_URL;

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          ...resumablePayload(),
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
          ...resumablePayload({
            name: "Large image",
            type: "image",
            fileName: "large.jpg",
            mimeType: "image/jpeg",
            totalBytes: chunkBytes + 1
          }),
          uploadUrl: TEST_UPLOAD_URL,
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

  it("treats an authoritative partial Drive range and a missing 308 range as valid", () => {
    const chunkBytes = 256 * 1024;
    const partialContext = loadAppsScriptBridge();
    partialContext.urlFetchApp.fetch.mockReturnValueOnce(createUrlFetchResponse(308, "", { Range: "bytes=0-10" }));
    const missingRangeContext = loadAppsScriptBridge();
    missingRangeContext.urlFetchApp.fetch.mockReturnValueOnce(createUrlFetchResponse(308));
    const payload = {
      ...resumablePayload({
        name: "Large image",
        type: "image",
        fileName: "large.jpg",
        mimeType: "image/jpeg",
        totalBytes: chunkBytes + 1
      }),
      uploadUrl: TEST_UPLOAD_URL,
      chunkBase64: Buffer.alloc(chunkBytes, 1).toString("base64"),
      startByte: 0,
      endByte: chunkBytes - 1
    };

    const partialResult = parseResult(partialContext.doPost(postEvent("media-upload-chunk", payload)));
    const missingRangeResult = parseResult(missingRangeContext.doPost(postEvent("media-upload-chunk", payload)));

    expect(partialResult.body).toMatchObject({ uploadComplete: false, nextByte: 11 });
    expect(missingRangeResult.body).toMatchObject({ uploadComplete: false, nextByte: 0 });
  });

  it("queries session status for 308 responses with and without a Range header", () => {
    const rangeContext = loadAppsScriptBridge();
    rangeContext.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(308, "", { Range: "bytes=0-9" }));
    const emptyRangeContext = loadAppsScriptBridge();
    emptyRangeContext.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(308));

    const rangeResult = parseResult(
      rangeContext.doPost(
        postEvent("media-upload-status", { ...resumablePayload({ totalBytes: 20 }), uploadUrl: TEST_UPLOAD_URL })
      )
    );
    const emptyRangeResult = parseResult(
      emptyRangeContext.doPost(
        postEvent("media-upload-status", { ...resumablePayload({ totalBytes: 20 }), uploadUrl: TEST_UPLOAD_URL })
      )
    );

    expect(rangeResult.body).toMatchObject({ uploadComplete: false, nextByte: 10 });
    expect(emptyRangeResult.body).toMatchObject({ uploadComplete: false, nextByte: 0 });
    expect(rangeContext.urlFetchApp.fetch.mock.calls[1][1]).toMatchObject({
      method: "put",
      headers: { "Content-Range": "*/20" },
      muteHttpExceptions: true,
      followRedirects: false
    });
    expect(rangeContext.urlFetchApp.fetch.mock.calls[1][1].headers["Content-Range"]).not.toMatch(/^bytes\s/i);
    expect(rangeContext.urlFetchApp.fetch.mock.calls[1][1]).not.toHaveProperty("payload");
  });

  it("recovers status completion from a Drive file id or a post-probe upload-key lookup", () => {
    const directContext = loadAppsScriptBridge({ uploadedMimeType: "application/pdf" });
    directContext.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(200, JSON.stringify({ id: "drive-file-1" })));
    const fallbackContext = loadAppsScriptBridge({ uploadedMimeType: "application/pdf" });
    fallbackContext.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(200, "{}"))
      .mockReturnValueOnce(completedDriveLookupResponse());

    const directResult = parseResult(
      directContext.doPost(postEvent("media-upload-status", { ...resumablePayload(), uploadUrl: TEST_UPLOAD_URL }))
    );
    const fallbackResult = parseResult(
      fallbackContext.doPost(postEvent("media-upload-status", { ...resumablePayload(), uploadUrl: TEST_UPLOAD_URL }))
    );

    expect(directResult.body).toMatchObject({ uploadComplete: true, asset: { id: "drive-file-1" } });
    expect(fallbackResult.body).toMatchObject({ uploadComplete: true, asset: { id: "drive-file-1" } });
  });

  it("recovers an expired status probe when the completed file appears after the probe", () => {
    const context = loadAppsScriptBridge({ uploadedMimeType: "application/pdf" });
    context.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(404))
      .mockReturnValueOnce(completedDriveLookupResponse());

    const result = parseResult(
      context.doPost(postEvent("media-upload-status", { ...resumablePayload(), uploadUrl: TEST_UPLOAD_URL }))
    );

    expect(result.body).toMatchObject({ uploadComplete: true, asset: { id: "drive-file-1" } });
  });

  it.each([404, 410])("returns a structured expiration code for Drive %i without a completed file", (status) => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    context.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(status))
      .mockReturnValueOnce(emptyDriveLookupResponse());

    const result = parseResult(
      context.doPost(postEvent("media-upload-status", { ...resumablePayload(), uploadUrl: TEST_UPLOAD_URL }))
    );

    expect(result).toMatchObject({
      statusCode: 410,
      body: { code: "MEDIA_UPLOAD_SESSION_EXPIRED" }
    });
    consoleErrorSpy.mockRestore();
  });

  it("classifies Drive 403 rateLimitExceeded as transient", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const context = loadAppsScriptBridge();

    context.urlFetchApp.fetch.mockReturnValueOnce(emptyDriveLookupResponse()).mockReturnValueOnce(
      createUrlFetchResponse(
        403,
        JSON.stringify({
          error: {
            errors: [{ reason: "rateLimitExceeded" }]
          }
        })
      )
    );

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-status", {
          ...resumablePayload({ totalBytes: 20 }),
          uploadUrl: TEST_UPLOAD_URL
        })
      )
    );

    expect(result).toMatchObject({
      statusCode: 503,
      body: {
        code: "DRIVE_UPLOAD_TRANSIENT"
      }
    });

    consoleErrorSpy.mockRestore();
  });

  it("treats a non-rate-limit Drive 403 as an expired resumable session", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const context = loadAppsScriptBridge();

    context.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(
        createUrlFetchResponse(
          403,
          JSON.stringify({
            error: {
              errors: [{ reason: "insufficientFilePermissions" }]
            }
          })
        )
      )
      .mockReturnValueOnce(emptyDriveLookupResponse());

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-status", {
          ...resumablePayload({ totalBytes: 20 }),
          uploadUrl: TEST_UPLOAD_URL
        })
      )
    );

    expect(result).toMatchObject({
      statusCode: 410,
      body: {
        code: "MEDIA_UPLOAD_SESSION_EXPIRED"
      }
    });

    consoleErrorSpy.mockRestore();
  });

  it.each([408, 429, 500, 502, 503])("classifies Drive status %i as a transient status-query error", (status) => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    context.urlFetchApp.fetch
      .mockReturnValueOnce(emptyDriveLookupResponse())
      .mockReturnValueOnce(createUrlFetchResponse(status));

    const result = parseResult(
      context.doPost(postEvent("media-upload-status", { ...resumablePayload(), uploadUrl: TEST_UPLOAD_URL }))
    );

    expect(result.body).toMatchObject({ code: "DRIVE_UPLOAD_TRANSIENT" });
    expect(result.statusCode).toBe(status === 408 || status === 429 ? status : 503);
    consoleErrorSpy.mockRestore();
  });

  it("rejects an unsafe status URL before any Drive lookup or probe", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-status", {
          ...resumablePayload(),
          uploadUrl: "https://example.invalid/upload/drive/v3/files?uploadType=resumable&upload_id=test"
        })
      )
    );

    expect(result).toMatchObject({ statusCode: 400, body: { error: "Invalid Drive upload session." } });
    expect(context.urlFetchApp.fetch).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it.each([408, 429, 500, 503])("classifies Drive chunk status %i with the transient protocol code", (status) => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    context.urlFetchApp.fetch.mockReturnValueOnce(createUrlFetchResponse(status));

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          ...resumablePayload(),
          uploadUrl: TEST_UPLOAD_URL,
          chunkBase64: "AQI=",
          startByte: 0,
          endByte: 1
        })
      )
    );

    expect(result.body).toMatchObject({ code: "DRIVE_UPLOAD_TRANSIENT" });
    consoleErrorSpy.mockRestore();
  });

  it("rejects unsafe upload session URLs and inconsistent chunk ranges before Drive fetch", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    const basePayload = {
      ...resumablePayload({ name: "Document", fileName: "document.pdf" }),
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
          uploadUrl: TEST_UPLOAD_URL,
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
          ...resumablePayload({ name: "Document", fileName: "document.pdf" }),
          uploadUrl: TEST_UPLOAD_URL,
          chunkBase64: "AQI=",
          startByte: 0,
          endByte: 1
        })
      )
    );

    expect(result.statusCode).toBe(410);
    expect(result.body.error).toBe("Media upload session expired. Please retry the upload.");
    expect(result.body.code).toBe("MEDIA_UPLOAD_SESSION_EXPIRED");
    expect(JSON.stringify(result.body)).not.toContain("test-upload-session");
    consoleErrorSpy.mockRestore();
  });

  it("redacts upload sessions and OAuth credentials from unexpected error responses and logs", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const context = loadAppsScriptBridge();
    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=private-session";
    context.urlFetchApp.fetch.mockImplementationOnce(() => {
      throw new Error(`request failed for ${uploadUrl} upload ${TEST_UPLOAD_KEY} bearer private-oauth-token`);
    });

    const result = parseResult(
      context.doPost(
        postEvent("media-upload-chunk", {
          ...resumablePayload({ name: "Document", fileName: "document.pdf" }),
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
    expect(logged).not.toContain(TEST_UPLOAD_KEY);
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
