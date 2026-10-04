import { Blockquote } from "@tiptap/extension-blockquote";
import Highlight from "@tiptap/extension-highlight";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { Link } from "@tiptap/extension-link";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Strike } from "@tiptap/extension-strike";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import RichTextEditorCore, { type RichTextEditorCoreProps } from "./RichTextEditorCore";

const advancedExtensions = [
  Blockquote,
  BulletList,
  HorizontalRule,
  Link,
  ListItem,
  ListKeymap,
  OrderedList,
  Strike,
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
];

type RichTextEditorOptionalModeProps = Omit<
  RichTextEditorCoreProps,
  "additionalExtensions" | "advancedSupportEnabled" | "onRequestAdvancedSupport"
>;

export default function RichTextEditorOptionalMode(props: RichTextEditorOptionalModeProps) {
  return <RichTextEditorCore {...props} additionalExtensions={advancedExtensions} advancedSupportEnabled />;
}
