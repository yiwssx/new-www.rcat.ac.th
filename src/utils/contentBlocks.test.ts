import { describe, expect, it } from "vitest";
import {
  CONTENT_BLOCKS_MARKER,
  createContentBlock,
  extractMediaIdsFromContentBlocks,
  parseContentBodyToBlocks,
  serializeContentBlocksToBody
} from "./contentBlocks";

describe("contentBlocks", () => {
  it("parses legacy plain-text body into paragraph blocks", () => {
    const blocks = parseContentBodyToBlocks("First paragraph.\n\nSecond paragraph.");

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("paragraph");
    expect(blocks[1]?.type).toBe("paragraph");
  });

  it("serializes and parses structured block payload", () => {
    const serialized = serializeContentBlocksToBody([
      {
        id: "heading-1",
        type: "heading",
        text: "Admissions Update",
        level: 2
      },
      {
        id: "paragraph-1",
        type: "paragraph",
        text: "Enrollment opens next month."
      },
      {
        id: "button-1",
        type: "button",
        label: "Apply now",
        href: "https://example.edu/apply",
        variant: "contained"
      }
    ]);

    expect(serialized.startsWith(CONTENT_BLOCKS_MARKER)).toBe(true);
    const parsed = parseContentBodyToBlocks(serialized);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ type: "heading", text: "Admissions Update" });
  });

  it("creates and preserves Facebook post blocks safely", () => {
    const block = createContentBlock("facebookPost");

    expect(block).toMatchObject({
      type: "facebookPost",
      href: "",
      caption: "",
      showText: true,
      width: 500
    });

    const serialized = serializeContentBlocksToBody([
      {
        id: "facebook-1",
        type: "facebookPost",
        href: " https://www.facebook.com/rcat/posts/12345 ",
        caption: "Official update",
        showText: true,
        width: 900
      }
    ]);

    const parsed = parseContentBodyToBlocks(serialized);

    expect(parsed).toEqual([
      {
        id: "facebook-1",
        type: "facebookPost",
        href: "https://www.facebook.com/rcat/posts/12345",
        caption: "Official update",
        showText: true,
        width: 750
      }
    ]);
  });

  it("creates and preserves external and media attachment link blocks", () => {
    expect(createContentBlock("link")).toMatchObject({
      type: "link",
      source: "external",
      label: "",
      href: "",
      mediaId: ""
    });

    const serialized = serializeContentBlocksToBody([
      {
        id: "external-link",
        type: "link",
        source: "external",
        label: "ประกาศต้นฉบับ",
        href: " https://example.org/notice ",
        mediaId: ""
      },
      {
        id: "media-link",
        type: "link",
        source: "media",
        label: "ดาวน์โหลดแบบฟอร์ม",
        href: "",
        mediaId: " media-document "
      }
    ]);

    expect(parseContentBodyToBlocks(serialized)).toEqual([
      {
        id: "external-link",
        type: "link",
        source: "external",
        label: "ประกาศต้นฉบับ",
        href: "https://example.org/notice",
        mediaId: ""
      },
      {
        id: "media-link",
        type: "link",
        source: "media",
        label: "ดาวน์โหลดแบบฟอร์ม",
        href: "",
        mediaId: "media-document"
      }
    ]);
  });

  it("creates and preserves PDF media blocks", () => {
    const block = createContentBlock("pdf");

    expect(block).toMatchObject({ type: "pdf", mediaId: "", caption: "" });

    const serialized = serializeContentBlocksToBody([
      {
        id: "pdf-1",
        type: "pdf",
        mediaId: "media-pdf",
        caption: "คู่มือนักศึกษา"
      }
    ]);

    expect(parseContentBodyToBlocks(serialized)).toEqual([
      {
        id: "pdf-1",
        type: "pdf",
        mediaId: "media-pdf",
        caption: "คู่มือนักศึกษา"
      }
    ]);
  });

  it("extracts unique media ids from visual blocks and media attachment links", () => {
    const mediaIds = extractMediaIdsFromContentBlocks([
      {
        id: "image-1",
        type: "image",
        mediaId: "media-1",
        caption: "Cover"
      },
      {
        id: "video-1",
        type: "video",
        mediaId: "media-2",
        caption: ""
      },
      {
        id: "pdf-1",
        type: "pdf",
        mediaId: "media-3",
        caption: "PDF"
      },
      {
        id: "image-2",
        type: "image",
        mediaId: "media-1",
        caption: ""
      },
      {
        id: "media-link",
        type: "link",
        source: "media",
        label: "Download",
        href: "",
        mediaId: "media-4"
      },
      {
        id: "external-link",
        type: "link",
        source: "external",
        label: "Source",
        href: "https://example.org",
        mediaId: "media-should-not-be-used"
      }
    ]);

    expect(mediaIds).toEqual(["media-1", "media-2", "media-3", "media-4"]);
  });
});
