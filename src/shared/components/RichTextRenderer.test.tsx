import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RichTextDocument } from "../../utils/contentBlocks";
import { getFlagEmojiAssetUrl } from "../../utils/flagEmoji";
import RichTextRenderer from "./RichTextRenderer";

function render(document: RichTextDocument) {
  return renderToString(<RichTextRenderer document={document} />);
}

describe("RichTextRenderer regressions", () => {
  it("keeps Thai text and country flags SSR-safe", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด 🇹🇭" }]
        }
      ]
    });

    expect(html).toContain("วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด");
    expect(html).toContain(getFlagEmojiAssetUrl("🇹🇭"));
    expect(html).toContain("<p");
    expect(html.indexOf("<span")).toBeGreaterThan(html.indexOf("<p"));
  });

  it("renders safe links and drops unsafe javascript links", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Safe",
              marks: [{ type: "link", attrs: { href: "https://www.rcat.ac.th/news" } }]
            },
            { type: "text", text: " / " },
            {
              type: "text",
              text: "Unsafe",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }]
            }
          ]
        }
      ]
    });

    expect(html).toContain('href="https://www.rcat.ac.th/news"');
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).toContain("Unsafe");
  });

  it("preserves semantic headings, lists, and table markup for no-JS rendering", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "หัวข้อประกาศ" }]
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "รายการที่หนึ่ง" }] }]
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
                  content: [{ type: "paragraph", content: [{ type: "text", text: "หัวตาราง" }] }]
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
    });

    expect(html).toContain("<h2");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("<td");
    expect(html).toContain("หัวตาราง");
  });

  it("renders text and formatting marks as React nodes instead of interpreting raw HTML", () => {
    const html = render({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: '<script>alert("x")</script>',
              marks: [{ type: "bold" }, { type: "highlight", attrs: { color: "#ffff00" } }]
            }
          ]
        }
      ]
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>");
    expect(html).toContain("<mark");
  });
});
