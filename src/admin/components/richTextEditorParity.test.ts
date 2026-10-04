import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Editor, type Content } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading } from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { TableKit } from "@tiptap/extension-table";
import { Text } from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { UndoRedo } from "@tiptap/extensions";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseContentBodyToBlocks,
  serializeContentBlocksToBody,
  type RichTextContentBlock,
  normalizeRichTextDocument
} from "../../utils/contentBlocks";

function createParityEditor(content: Content) {
  return new Editor({
    element: document.createElement("div"),
    extensions: [
      Bold,
      Blockquote,
      BulletList,
      Document,
      HardBreak,
      Heading.configure({ levels: [2, 3, 4] }),
      UndoRedo,
      HorizontalRule,
      Italic,
      ListItem,
      ListKeymap,
      Link,
      OrderedList,
      Paragraph,
      Strike,
      Text,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"]
      }),
      TableKit.configure({
        table: {
          resizable: true
        }
      })
    ],
    content
  });
}

function findMark(node: { marks?: Array<{ type?: string; attrs?: Record<string, unknown> }> }, type: string) {
  return node.marks?.find((mark) => mark.type === type);
}

const editors: Editor[] = [];

function track(editor: Editor) {
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) {
    editors.pop()?.destroy();
  }
});

describe("v3.3.2 rich-text editor behavior parity", () => {
  it("keeps the production implementation on the explicit lean extension set and editor commands", () => {
    const source = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");

    expect(source).not.toContain("@tiptap/starter-kit");
    for (const requiredToken of [
      "Bold,",
      "Blockquote,",
      "BulletList,",
      "Heading.configure",
      "UndoRedo,",
      "Link,",
      "OrderedList,",
      "Underline,",
      "TextStyle,",
      "Color,",
      "Highlight.configure",
      "TextAlign.configure",
      "TableKit.configure",
      "toggleBold()",
      "toggleItalic()",
      "toggleUnderline()",
      "toggleStrike()",
      "setColor(event.target.value)",
      "setHighlight({ color: event.target.value })",
      'setTextAlign("center")',
      "insertTable({ rows: 3, cols: 3, withHeaderRow: true })",
      "setLink({ href: normalizedHref })"
    ]) {
      expect(source).toContain(requiredToken);
    }
  });

  it("preserves heading, alignment, marks, colors, highlight, and safe-link semantics", () => {
    const text = "RCAT editor";
    const editor = track(
      createParityEditor({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text }] }]
      })
    );

    expect(
      editor
        .chain()
        .setTextSelection({ from: 1, to: text.length + 1 })
        .toggleBold()
        .toggleItalic()
        .toggleUnderline()
        .toggleStrike()
        .setColor("#123456")
        .setHighlight({ color: "#ffeeaa" })
        .setLink({ href: "/documents?category=ITA" })
        .setTextAlign("center")
        .toggleHeading({ level: 2 })
        .run()
    ).toBe(true);

    const document = normalizeRichTextDocument(editor.getJSON());
    const heading = document.content?.[0];
    const textNode = heading?.content?.[0];

    expect(heading).toMatchObject({ type: "heading", attrs: { level: 2, textAlign: "center" } });
    expect(textNode).toMatchObject({ type: "text", text });
    expect(textNode?.marks?.map((mark) => mark.type)).toEqual(
      expect.arrayContaining(["bold", "italic", "underline", "strike", "textStyle", "highlight", "link"])
    );
    expect(findMark(textNode ?? {}, "textStyle")?.attrs).toMatchObject({ color: "#123456" });
    expect(findMark(textNode ?? {}, "highlight")?.attrs).toMatchObject({ color: "#ffeeaa" });
    expect(findMark(textNode ?? {}, "link")?.attrs).toMatchObject({ href: "/documents?category=ITA" });
  });

  it("keeps list, table, and horizontal-rule commands available after StarterKit removal", () => {
    const listText = "รายการหนึ่ง";
    const listEditor = track(
      createParityEditor({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: listText }] }]
      })
    );

    expect(
      listEditor
        .chain()
        .setTextSelection({ from: 1, to: listText.length + 1 })
        .toggleBulletList()
        .run()
    ).toBe(true);
    expect(normalizeRichTextDocument(listEditor.getJSON()).content?.[0]).toMatchObject({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: listText }] }]
        }
      ]
    });

    const tableEditor = track(createParityEditor({ type: "doc", content: [{ type: "paragraph" }] }));
    expect(tableEditor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()).toBe(true);
    const table = normalizeRichTextDocument(tableEditor.getJSON()).content?.find((node) => node.type === "table");
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[0]?.content).toHaveLength(3);
    expect(table?.content?.[0]?.content?.every((cell) => cell.type === "tableHeader")).toBe(true);

    const ruleEditor = track(createParityEditor({ type: "doc", content: [{ type: "paragraph" }] }));
    expect(ruleEditor.chain().focus().setHorizontalRule().run()).toBe(true);
    expect(
      normalizeRichTextDocument(ruleEditor.getJSON()).content?.some((node) => node.type === "horizontalRule")
    ).toBe(true);
  });

  it("round-trips command-produced rich text through the unchanged RCAT_BLOCKS_V1 save representation", () => {
    const editor = track(
      createParityEditor({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 3, textAlign: "right" },
            content: [
              {
                type: "text",
                text: "หลักฐาน parity",
                marks: [
                  { type: "bold" },
                  { type: "textStyle", attrs: { color: "#224466" } },
                  { type: "highlight", attrs: { color: "#fff2a8" } },
                  { type: "link", attrs: { href: "/documents?q=OIT" } }
                ]
              }
            ]
          }
        ]
      })
    );

    const normalized = normalizeRichTextDocument(editor.getJSON());
    const block: RichTextContentBlock = {
      id: "task6-parity",
      type: "richText",
      document: normalized
    };
    const savedBody = serializeContentBlocksToBody([block]);

    expect(parseContentBodyToBlocks(savedBody)).toEqual([block]);
  });
});
