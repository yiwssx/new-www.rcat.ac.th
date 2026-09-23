import { describe, expect, it } from "vitest";
import {
  CONTENT_BLOCKS_MARKER,
  parseContentBodyToBlocks,
  serializeContentBlocksToBody,
  type RichTextContentBlock
} from "./contentBlocks";

function roundTrip(block: RichTextContentBlock) {
  return parseContentBodyToBlocks(serializeContentBlocksToBody([block]));
}

describe("rich-text persistence regressions", () => {
  it("round-trips Thai text, emoji, links, lists, and tables without changing the content format marker", () => {
    const block: RichTextContentBlock = {
      id: "rich-roundtrip",
      type: "richText",
      document: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: "center" },
            content: [{ type: "text", text: "ข่าวประชาสัมพันธ์ 🇹🇭", marks: [{ type: "bold" }] }]
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "อ่านรายละเอียด",
                marks: [{ type: "link", attrs: { href: "/news/example" } }]
              }
            ]
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "รายการหนึ่ง" }] }]
              }
            ]
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "หัวข้อ" }] }]
                  },
                  {
                    type: "tableCell",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "ข้อมูล" }] }]
                  }
                ]
              }
            ]
          }
        ]
      }
    };

    const serialized = serializeContentBlocksToBody([block]);
    expect(serialized.startsWith(CONTENT_BLOCKS_MARKER)).toBe(true);
    expect(roundTrip(block)).toEqual([block]);
  });

  it("normalizes heading levels, text alignment, ordered-list start, and rich-text colors on reopen", () => {
    const rawBody = `${CONTENT_BLOCKS_MARKER}${JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "rich-normalize",
          type: "richText",
          document: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 1, textAlign: "unsupported" },
                content: [
                  {
                    type: "text",
                    text: "หัวข้อ",
                    marks: [
                      { type: "textStyle", attrs: { color: "#AABBCC" } },
                      { type: "highlight", attrs: { color: "not-a-color" } }
                    ]
                  }
                ]
              },
              {
                type: "orderedList",
                attrs: { start: 3 },
                content: [
                  {
                    type: "listItem",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "ข้อสาม" }] }]
                  }
                ]
              }
            ]
          }
        }
      ]
    })}`;

    const parsed = parseContentBodyToBlocks(rawBody);
    expect(parsed[0]).toMatchObject({
      type: "richText",
      document: {
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              {
                type: "text",
                marks: [{ type: "textStyle", attrs: { color: "#aabbcc" } }, { type: "highlight" }]
              }
            ]
          },
          { type: "orderedList", attrs: { start: 3 } }
        ]
      }
    });
  });

  it("drops unsupported rich-text nodes and marks instead of persisting arbitrary structures", () => {
    const rawBody = `${CONTENT_BLOCKS_MARKER}${JSON.stringify({
      version: 1,
      blocks: [
        {
          id: "rich-unsafe",
          type: "richText",
          document: {
            type: "doc",
            content: [
              { type: "rawHtml", html: "<script>alert(1)</script>" },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "ข้อความปลอดภัย",
                    marks: [{ type: "unknownMark", attrs: { onclick: "alert(1)" } }]
                  }
                ]
              }
            ]
          }
        }
      ]
    })}`;

    const parsed = parseContentBodyToBlocks(rawBody);
    expect(JSON.stringify(parsed)).not.toContain("rawHtml");
    expect(JSON.stringify(parsed)).not.toContain("unknownMark");
    expect(JSON.stringify(parsed)).not.toContain("onclick");
    expect(parsed[0]).toMatchObject({
      type: "richText",
      document: {
        content: [{ type: "paragraph", content: [{ type: "text", text: "ข้อความปลอดภัย" }] }]
      }
    });
  });
});
