import { describe, expect, it, vi, type Mock } from "vitest";
import cmsSource from "../../apps-script/Cms.gs?raw";

interface HttpError extends Error {
  statusCode?: number;
}

interface CmsScriptContext {
  assertUniqueContentSlug: (sheet: unknown, contentId: string, normalizedSlug: string) => void;
  isAllowedUploadMimeType: (value: string) => boolean;
  normalizeSlugValue: (value: string) => string;
  resolveUploadMimeType: (asset: { mimeType?: string; fileBase64?: string }) => string;
  sanitizePublicContentRecord: (
    item: Record<string, unknown>,
    options?: { includeBody?: boolean }
  ) => Record<string, unknown>;
  sanitizePublicMediaRecord: (asset: Record<string, unknown>) => Record<string, unknown>;
  validateContentStatus: (value: string) => string;
  validateContentType: (value: string) => string;
  validateUploadBytes: (bytes: { length: number } | null) => void;
  readObjects: Mock;
}

function createHttpError(message: string, statusCode: number) {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function loadCmsScript() {
  const readObjects = vi.fn();
  const createScriptExports = new Function(
    "console",
    "createHttpError",
    "readObjects",
    "CONTENT_HEADERS",
    `${cmsSource}
return {
  assertUniqueContentSlug,
  isAllowedUploadMimeType,
  normalizeSlugValue,
  resolveUploadMimeType,
  sanitizePublicContentRecord,
  sanitizePublicMediaRecord,
  validateContentStatus,
  validateContentType,
  validateUploadBytes
};`
  );
  const exports = createScriptExports(
    console,
    createHttpError,
    readObjects,
    ["id", "slug"]
  ) as Omit<CmsScriptContext, "readObjects">;

  return {
    ...exports,
    readObjects
  };
}

function captureError(fn: () => void) {
  try {
    fn();
    return null;
  } catch (error) {
    return error as HttpError;
  }
}

describe("Apps Script CMS helpers", () => {
  it("normalizes slugs and rejects duplicate slugs for other content records", () => {
    const context = loadCmsScript();
    context.readObjects.mockReturnValue([
      { id: "content-1", slug: " Admissions " },
      { id: "content-2", slug: "student-news" }
    ]);

    expect(context.normalizeSlugValue(" Admissions ")).toBe("admissions");
    expect(() => context.assertUniqueContentSlug({}, "content-1", "admissions")).not.toThrow();

    const error = captureError(() => context.assertUniqueContentSlug({}, "content-3", "admissions"));
    expect(error?.message).toBe("Slug นี้ถูกใช้งานแล้ว กรุณาเปลี่ยนลิงก์ถาวร");
    expect(error?.statusCode).toBe(409);
  });

  it("validates content type and status values", () => {
    const context = loadCmsScript();

    expect(context.validateContentType(" News ")).toBe("news");
    expect(context.validateContentStatus("PUBLISHED")).toBe("published");

    expect(captureError(() => context.validateContentType("script"))?.statusCode).toBe(400);
    expect(captureError(() => context.validateContentStatus("archived"))?.statusCode).toBe(400);
  });

  it("scrubs document storage fields from public content records", () => {
    const context = loadCmsScript();
    const item = {
      id: "content-1",
      title: "Public item",
      body: "Body text",
      bodyDocId: "doc-id",
      bodyDocUrl: "https://docs.google.com/document/d/doc-id",
      mediaIds: ["media-1"]
    };

    const snapshotRecord = context.sanitizePublicContentRecord(item);
    expect(snapshotRecord).not.toHaveProperty("body");
    expect(snapshotRecord).not.toHaveProperty("bodyDocId");
    expect(snapshotRecord).not.toHaveProperty("bodyDocUrl");
    expect(snapshotRecord.mediaIds).toEqual(["media-1"]);

    const detailRecord = context.sanitizePublicContentRecord(item, { includeBody: true });
    expect(detailRecord.body).toBe("Body text");
    expect(detailRecord).not.toHaveProperty("bodyDocId");
    expect(detailRecord).not.toHaveProperty("bodyDocUrl");
  });

  it("reduces public media records to fields needed for rendering", () => {
    const context = loadCmsScript();
    const media = context.sanitizePublicMediaRecord({
      id: "media-1",
      name: "Public image",
      type: "image",
      size: "9 MB",
      owner: "Admin",
      driveUrl: "https://drive.google.com/file/d/media-1/view",
      fileId: "media-1",
      mimeType: "image/png",
      previewUrl: "https://drive.google.com/thumbnail?id=media-1",
      embedUrl: "https://drive.google.com/file/d/media-1/preview",
      updatedAt: "2026-04-28T00:00:00.000Z"
    });

    expect(media).toEqual({
      id: "media-1",
      name: "Public image",
      type: "image",
      size: "",
      owner: "",
      driveUrl: "https://drive.google.com/file/d/media-1/view",
      previewUrl: "https://drive.google.com/thumbnail?id=media-1",
      embedUrl: "https://drive.google.com/file/d/media-1/preview",
      updatedAt: ""
    });
    expect(media).not.toHaveProperty("fileId");
    expect(media).not.toHaveProperty("mimeType");
  });

  it("allows expected upload MIME types and rejects unknown or oversized uploads", () => {
    const context = loadCmsScript();

    expect(context.isAllowedUploadMimeType("image/png")).toBe(true);
    expect(context.isAllowedUploadMimeType("video/mp4")).toBe(true);
    expect(context.isAllowedUploadMimeType("application/pdf")).toBe(true);
    expect(context.isAllowedUploadMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(context.isAllowedUploadMimeType("application/javascript")).toBe(false);
    expect(context.resolveUploadMimeType({ fileBase64: "data:text/csv;base64,YSxi" })).toBe("text/csv");

    expect(captureError(() => context.resolveUploadMimeType({ mimeType: "application/octet-stream" }))?.statusCode).toBe(400);
    expect(captureError(() => context.validateUploadBytes({ length: 10 * 1024 * 1024 + 1 }))?.statusCode).toBe(413);
    expect(() => context.validateUploadBytes({ length: 10 * 1024 * 1024 })).not.toThrow();
  });
});
