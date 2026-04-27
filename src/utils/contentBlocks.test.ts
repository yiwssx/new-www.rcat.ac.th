import { describe, expect, it } from "vitest";
import {
  CONTENT_BLOCKS_MARKER,
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

  it("extracts unique media ids from image/video blocks", () => {
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
        id: "image-2",
        type: "image",
        mediaId: "media-1",
        caption: ""
      }
    ]);

    expect(mediaIds).toEqual(["media-1", "media-2"]);
  });
});
