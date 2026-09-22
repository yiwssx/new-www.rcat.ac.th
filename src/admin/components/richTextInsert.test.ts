import { describe, expect, it } from "vitest";
import type { MediaAsset } from "../../types";
import {
  createBlockFromRichTextInsert,
  insertContentBlockAfter,
  type RichTextExternalInsertRequest
} from "./richTextInsert";

const imageAsset: MediaAsset = {
  id: "media-image",
  name: "ภาพกิจกรรม",
  type: "image",
  size: "1 MB",
  owner: "admin",
  driveUrl: "https://example.org/image",
  updatedAt: "2026-09-22T00:00:00.000Z"
};

describe("richTextInsert", () => {
  it("maps a selected image to the existing image content block", () => {
    const block = createBlockFromRichTextInsert({
      type: "image",
      asset: imageAsset
    });

    expect(block).toMatchObject({
      type: "image",
      mediaId: "media-image",
      caption: "ภาพกิจกรรม"
    });
  });

  it("maps a generic media file to a media-backed link block", () => {
    const asset: MediaAsset = {
      ...imageAsset,
      id: "media-doc",
      name: "แบบฟอร์มดาวน์โหลด",
      type: "document"
    };

    const request: RichTextExternalInsertRequest = {
      type: "file",
      asset
    };
    const block = createBlockFromRichTextInsert(request);

    expect(block).toMatchObject({
      type: "link",
      source: "media",
      label: "แบบฟอร์มดาวน์โหลด",
      mediaId: "media-doc",
      href: ""
    });
  });

  it("inserts the specialized block immediately after the active rich-text block", () => {
    const blocks = [
      {
        id: "rich-1",
        type: "richText" as const,
        document: {
          type: "doc" as const,
          content: [{ type: "paragraph" as const }]
        }
      },
      {
        id: "paragraph-1",
        type: "paragraph" as const,
        text: "ท้ายบทความ"
      }
    ];

    const inserted = insertContentBlockAfter(
      blocks,
      "rich-1",
      createBlockFromRichTextInsert({ type: "button" })
    );

    expect(inserted.map((block) => block.type)).toEqual(["richText", "button", "paragraph"]);
  });
});
