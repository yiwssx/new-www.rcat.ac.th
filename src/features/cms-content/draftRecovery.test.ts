import { beforeEach, describe, expect, it } from "vitest";
import type { ContentItem } from "../public-content/types";
import { clearContentDraftRecovery, readContentDraftRecovery, writeContentDraftRecovery } from "./draftRecovery";

const ownerUserId = "editor-1";
const now = new Date("2026-08-01T05:00:00.000Z").getTime();

function createItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: "content-1",
    title: "ฉบับร่างที่ยังไม่บันทึก",
    slug: "recovered-draft",
    type: "news",
    status: "draft",
    owner: "งานประชาสัมพันธ์",
    summary: "สรุปฉบับร่าง",
    body: "เนื้อหาฉบับร่าง",
    category: "ข่าว",
    tags: ["draft"],
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
    featured: false,
    readingMinutes: 2,
    template: "standard",
    bodyDocId: "doc-1",
    bodyDocUrl: "https://drive.google.com/document/d/doc-1/edit",
    featuredMediaId: "media-1",
    mediaIds: ["media-1"],
    updatedAt: "2026-08-01T05:00:00.000Z",
    publishAt: "",
    revision: 4,
    ...overrides
  };
}

function getStoredEntry() {
  const key = window.sessionStorage.key(0);
  expect(key).toBeTruthy();
  return { key: key as string, value: window.sessionStorage.getItem(key as string) as string };
}

describe("content draft recovery", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips whitelisted edit and create drafts for the same Admin", () => {
    expect(
      writeContentDraftRecovery({ mode: "edit", ownerUserId, item: createItem(), tagInputValue: "pending-tag" }, now)
    ).toBe(true);
    expect(readContentDraftRecovery(ownerUserId, now)).toEqual({
      mode: "edit",
      ownerUserId,
      savedAt: now,
      item: createItem(),
      tagInputValue: "pending-tag"
    });

    expect(
      writeContentDraftRecovery(
        { mode: "create", ownerUserId, item: createItem({ id: "", revision: undefined }), tagInputValue: "" },
        now
      )
    ).toBe(true);
    expect(readContentDraftRecovery(ownerUserId, now)?.mode).toBe("create");
    expect(readContentDraftRecovery(ownerUserId, now)?.item.id).toBe("");
  });

  it("isolates a draft by owner without deleting it when another account signs in", () => {
    writeContentDraftRecovery({ mode: "edit", ownerUserId, item: createItem(), tagInputValue: "" }, now);

    expect(readContentDraftRecovery("different-user", now)).toBeNull();
    expect(readContentDraftRecovery(ownerUserId, now)?.item.title).toBe("ฉบับร่างที่ยังไม่บันทึก");
  });

  it("rejects expired, future-dated, malformed, and mode/id-inconsistent entries", () => {
    writeContentDraftRecovery({ mode: "edit", ownerUserId, item: createItem(), tagInputValue: "" }, now);
    expect(readContentDraftRecovery(ownerUserId, now + 12 * 60 * 60 * 1000 + 1)).toBeNull();

    writeContentDraftRecovery({ mode: "edit", ownerUserId, item: createItem(), tagInputValue: "" }, now + 60_001);
    expect(readContentDraftRecovery(ownerUserId, now)).toBeNull();

    window.sessionStorage.setItem("rcat.cms.content-draft.v1", "not-json");
    expect(readContentDraftRecovery(ownerUserId, now)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);

    expect(writeContentDraftRecovery({ mode: "create", ownerUserId, item: createItem(), tagInputValue: "" }, now)).toBe(
      false
    );
    expect(
      writeContentDraftRecovery({ mode: "edit", ownerUserId, item: createItem({ id: "" }), tagInputValue: "" }, now)
    ).toBe(false);
  });

  it("stores only recoverable content fields and never arbitrary secret or file payload properties", () => {
    const unsafeItem = {
      ...createItem(),
      password: "do-not-store-password",
      csrfToken: "do-not-store-csrf",
      fileBase64: "do-not-store-base64",
      uploadFile: { name: "private.pdf" }
    } as ContentItem;

    expect(writeContentDraftRecovery({ mode: "edit", ownerUserId, item: unsafeItem, tagInputValue: "tag" }, now)).toBe(
      true
    );

    const serialized = getStoredEntry().value;
    expect(serialized).not.toContain("do-not-store");
    expect(serialized).not.toContain("private.pdf");
    expect(serialized).toContain("media-1");
  });

  it("fails safely when the serialized draft exceeds the storage guard", () => {
    expect(
      writeContentDraftRecovery(
        {
          mode: "edit",
          ownerUserId,
          item: createItem({ body: "x".repeat(512 * 1024) }),
          tagInputValue: ""
        },
        now
      )
    ).toBe(false);
    expect(window.sessionStorage.length).toBe(0);

    clearContentDraftRecovery();
    expect(window.sessionStorage.length).toBe(0);
  });
});
