import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Task 7 transform could not find ${label}.`);
  }
  return source.replace(before, after);
}

const implPath = "src/admin/components/RichTextEditorImpl.tsx";
const corePath = "src/admin/components/RichTextEditorCore.tsx";
const optionalModePath = "src/admin/components/RichTextEditorOptionalMode.tsx";
let coreSource = readFileSync(implPath, "utf8");

coreSource = replaceOnce(
  coreSource,
  'import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";\n',
  'import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";\nimport type { Extensions } from "@tiptap/core";\n',
  "Tiptap extension type import"
);
for (const importLine of [
  'import { Blockquote } from "@tiptap/extension-blockquote";\n',
  'import { HorizontalRule } from "@tiptap/extension-horizontal-rule";\n',
  'import { Link } from "@tiptap/extension-link";\n',
  'import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";\n',
  'import { Strike } from "@tiptap/extension-strike";\n',
  'import { Underline } from "@tiptap/extension-underline";\n',
  'import Highlight from "@tiptap/extension-highlight";\n',
  'import TextAlign from "@tiptap/extension-text-align";\n',
  'import { Color, TextStyle } from "@tiptap/extension-text-style";\n',
  'import { TableKit } from "@tiptap/extension-table";\n'
]) {
  coreSource = replaceOnce(coreSource, importLine, "", `advanced import ${importLine.trim()}`);
}
coreSource = replaceOnce(
  coreSource,
  `interface RichTextEditorProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n}`,
  `export interface RichTextEditorCoreProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n  additionalExtensions?: Extensions;\n  advancedSupportEnabled?: boolean;\n  pendingAdvancedCommand?: PendingAdvancedCommand | null;\n  onRequestAdvancedSupport?: (request: PendingAdvancedCommand) => void;\n  onAdvancedCommandApplied?: () => void;\n}`,
  "core props"
);
coreSource = replaceOnce(
  coreSource,
  'type InternalInsertCommand = "table" | "horizontalRule";',
  `type InternalInsertCommand = "table" | "horizontalRule";\n\nexport type AdvancedEditorCommand =\n  | { type: "underline" }\n  | { type: "strike" }\n  | { type: "color"; value: string }\n  | { type: "highlight"; value: string }\n  | { type: "textAlign"; value: "left" | "center" | "right" | "justify" }\n  | { type: "bulletList" }\n  | { type: "orderedList" }\n  | { type: "blockquote" }\n  | { type: "linkDialog" }\n  | { type: "table" }\n  | { type: "horizontalRule" };\n\nexport interface PendingAdvancedCommand {\n  command: AdvancedEditorCommand;\n  selection: { from: number; to: number };\n}`,
  "advanced command types"
);
coreSource = replaceOnce(
  coreSource,
  `export default function RichTextEditor({ value, onChange, onInsertBlock }: RichTextEditorProps) {`,
  `export default function RichTextEditorCore({\n  value,\n  onChange,\n  onInsertBlock,\n  additionalExtensions = [],\n  advancedSupportEnabled = false,\n  pendingAdvancedCommand = null,\n  onRequestAdvancedSupport,\n  onAdvancedCommandApplied\n}: RichTextEditorCoreProps) {`,
  "core component signature"
);
coreSource = replaceOnce(coreSource, "      Blockquote,\n      BulletList,\n", "", "blockquote/list registration");
coreSource = replaceOnce(coreSource, "      HorizontalRule,\n", "", "horizontal rule registration");
coreSource = replaceOnce(coreSource, "      ListItem,\n      ListKeymap,\n      Link,\n      OrderedList,\n", "", "list/link registration");
coreSource = replaceOnce(coreSource, "      Strike,\n", "", "strike registration");
coreSource = replaceOnce(coreSource, "      Underline,\n      TextStyle,\n      Color,\n      Highlight.configure({ multicolor: true }),\n      TextAlign.configure({\n        types: [\"heading\", \"paragraph\"],\n        alignments: [\"left\", \"center\", \"right\", \"justify\"]\n      }),\n      TableKit.configure({\n        table: {\n          resizable: true\n        }\n      })\n", "      ...additionalExtensions\n", "advanced extension registration");
coreSource = replaceOnce(
  coreSource,
  `    onUpdate: ({ editor: currentEditor }) => {\n      onChange(normalizeRichTextDocument(currentEditor.getJSON()));\n    }\n  });`,
  `    onCreate: ({ editor: currentEditor }) => {\n      if (!advancedSupportEnabled || pendingAdvancedCommand === null) {\n        return;\n      }\n\n      const { command, selection } = pendingAdvancedCommand;\n      const chain = currentEditor.chain().focus().setTextSelection(selection);\n\n      switch (command.type) {\n        case "underline":\n          chain.toggleUnderline().run();\n          break;\n        case "strike":\n          chain.toggleStrike().run();\n          break;\n        case "color":\n          chain.setColor(command.value).run();\n          break;\n        case "highlight":\n          chain.setHighlight({ color: command.value }).run();\n          break;\n        case "textAlign":\n          chain.setTextAlign(command.value).run();\n          break;\n        case "bulletList":\n          chain.toggleBulletList().run();\n          break;\n        case "orderedList":\n          chain.toggleOrderedList().run();\n          break;\n        case "blockquote":\n          chain.toggleBlockquote().run();\n          break;\n        case "table":\n          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n          break;\n        case "horizontalRule":\n          chain.setHorizontalRule().run();\n          break;\n        case "linkDialog": {\n          const { from, to } = currentEditor.state.selection;\n          setLinkHref(String(currentEditor.getAttributes("link").href || ""));\n          setLinkText(from === to ? "" : currentEditor.state.doc.textBetween(from, to, " "));\n          setLinkError("");\n          setLinkDialogOpen(true);\n          break;\n        }\n      }\n\n      onAdvancedCommandApplied?.();\n    },\n    onUpdate: ({ editor: currentEditor }) => {\n      onChange(normalizeRichTextDocument(currentEditor.getJSON()));\n    }\n  });`,
  "editor onCreate hook"
);
coreSource = replaceOnce(
  coreSource,
  `  const openLinkDialog = () => {\n    const { from, to } = editor.state.selection;`,
  `  const requestAdvancedCommand = (command: AdvancedEditorCommand) => {\n    onRequestAdvancedSupport?.({\n      command,\n      selection: { from: editor.state.selection.from, to: editor.state.selection.to }\n    });\n  };\n\n  const openLinkDialog = () => {\n    if (!advancedSupportEnabled) {\n      requestAdvancedCommand({ type: "linkDialog" });\n      setInsertAnchor(null);\n      return;\n    }\n\n    const { from, to } = editor.state.selection;`,
  "advanced link request"
);
coreSource = replaceOnce(
  coreSource,
  `    if (command === "table") {\n      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      return;\n    }\n\n    editor.chain().focus().setHorizontalRule().run();`,
  `    if (!advancedSupportEnabled) {\n      requestAdvancedCommand({ type: command });\n      return;\n    }\n\n    if (command === "table") {\n      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      return;\n    }\n\n    editor.chain().focus().setHorizontalRule().run();`,
  "advanced internal inserts"
);
coreSource = replaceOnce(
  coreSource,
  `    if (command === "bulletList") {\n      editor.chain().focus().toggleBulletList().run();\n      return;\n    }\n\n    if (command === "orderedList") {\n      editor.chain().focus().toggleOrderedList().run();\n      return;\n    }\n\n    editor.chain().focus().toggleBlockquote().run();`,
  `    if (!advancedSupportEnabled) {\n      requestAdvancedCommand({ type: command });\n      return;\n    }\n\n    if (command === "bulletList") {\n      editor.chain().focus().toggleBulletList().run();\n      return;\n    }\n\n    if (command === "orderedList") {\n      editor.chain().focus().toggleOrderedList().run();\n      return;\n    }\n\n    editor.chain().focus().toggleBlockquote().run();`,
  "advanced slash formatting"
);
coreSource = replaceOnce(
  coreSource,
  `          <ToolbarButton\n            label="U"\n            active={editor.isActive("underline")}\n            onClick={() => editor.chain().focus().toggleUnderline().run()}\n          />\n          <ToolbarButton\n            label="S"\n            active={editor.isActive("strike")}\n            onClick={() => editor.chain().focus().toggleStrike().run()}\n          />`,
  `          <ToolbarButton\n            label="U"\n            active={advancedSupportEnabled && editor.isActive("underline")}\n            onClick={() =>\n              advancedSupportEnabled\n                ? editor.chain().focus().toggleUnderline().run()\n                : requestAdvancedCommand({ type: "underline" })\n            }\n          />\n          <ToolbarButton\n            label="S"\n            active={advancedSupportEnabled && editor.isActive("strike")}\n            onClick={() =>\n              advancedSupportEnabled\n                ? editor.chain().focus().toggleStrike().run()\n                : requestAdvancedCommand({ type: "strike" })\n            }\n          />`,
  "advanced underline and strike controls"
);
coreSource = replaceOnce(
  coreSource,
  `            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}\n`,
  `            onChange={(event) =>\n              advancedSupportEnabled\n                ? editor.chain().focus().setColor(event.target.value).run()\n                : requestAdvancedCommand({ type: "color", value: event.target.value })\n            }\n`,
  "advanced color control"
);
coreSource = replaceOnce(
  coreSource,
  `            onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()}\n`,
  `            onChange={(event) =>\n              advancedSupportEnabled\n                ? editor.chain().focus().setHighlight({ color: event.target.value }).run()\n                : requestAdvancedCommand({ type: "highlight", value: event.target.value })\n            }\n`,
  "advanced highlight control"
);
for (const alignment of ["left", "center", "right"]) {
  coreSource = replaceOnce(
    coreSource,
    `active={editor.isActive({ textAlign: "${alignment}" })}\n            onClick={() => editor.chain().focus().setTextAlign("${alignment}").run()}`,
    `active={advancedSupportEnabled && editor.isActive({ textAlign: "${alignment}" })}\n            onClick={() =>\n              advancedSupportEnabled\n                ? editor.chain().focus().setTextAlign("${alignment}").run()\n                : requestAdvancedCommand({ type: "textAlign", value: "${alignment}" })\n            }`,
    `advanced ${alignment} alignment control`
  );
}
for (const [label, type, command] of [
  ["☰", "bulletList", "toggleBulletList"],
  ["1.", "orderedList", "toggleOrderedList"],
  ["❝", "blockquote", "toggleBlockquote"]
]) {
  coreSource = replaceOnce(
    coreSource,
    `label="${label}"\n            active={editor.isActive("${type}")}\n            onClick={() => editor.chain().focus().${command}().run()}`,
    `label="${label}"\n            active={advancedSupportEnabled && editor.isActive("${type}")}\n            onClick={() =>\n              advancedSupportEnabled\n                ? editor.chain().focus().${command}().run()\n                : requestAdvancedCommand({ type: "${type}" })\n            }`,
    `advanced ${type} toolbar control`
  );
}
coreSource = replaceOnce(coreSource, `active={editor.isActive("link")}`, `active={advancedSupportEnabled && editor.isActive("link")}`, "link active guard");
coreSource = replaceOnce(coreSource, `{editor.isActive("link") && (`, `{advancedSupportEnabled && editor.isActive("link") && (`, "unlink guard");
coreSource = replaceOnce(coreSource, `{editor.isActive("table") && (`, `{advancedSupportEnabled && editor.isActive("table") && (`, "table toolbar guard");
writeFileSync(corePath, coreSource);

const wrapperSource = `import { lazy, Suspense, useState } from "react";\nimport Box from "@mui/material/Box";\nimport Typography from "@mui/material/Typography";\nimport type { RichTextDocument } from "../../utils/contentBlocks";\nimport type { RichTextExternalInsertRequest } from "./richTextInsert";\nimport RichTextEditorCore, { type PendingAdvancedCommand } from "./RichTextEditorCore";\n\nconst RichTextEditorOptionalMode = lazy(() => import("./RichTextEditorOptionalMode"));\n\ninterface RichTextEditorProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n}\n\nfunction richTextNodeNeedsAdvancedMode(node: unknown): boolean {\n  if (!node || typeof node !== "object") {\n    return false;\n  }\n\n  const record = node as { type?: unknown; attrs?: unknown; marks?: unknown; content?: unknown };\n  if (["blockquote", "bulletList", "orderedList", "listItem", "table", "tableRow", "tableHeader", "tableCell", "horizontalRule"].includes(String(record.type ?? ""))) {\n    return true;\n  }\n\n  if (record.attrs && typeof record.attrs === "object" && "textAlign" in record.attrs && record.attrs.textAlign) {\n    return true;\n  }\n\n  if (Array.isArray(record.marks) && record.marks.some((mark) => {\n    if (!mark || typeof mark !== "object") {\n      return false;\n    }\n    const type = String((mark as { type?: unknown }).type ?? "");\n    return ["underline", "strike", "link", "textStyle", "highlight"].includes(type);\n  })) {\n    return true;\n  }\n\n  return Array.isArray(record.content) && record.content.some(richTextNodeNeedsAdvancedMode);\n}\n\nexport function richTextDocumentNeedsAdvancedMode(document: RichTextDocument) {\n  return richTextNodeNeedsAdvancedMode(document);\n}\n\nfunction OptionalModeFallback() {\n  return (\n    <Box\n      sx={{\n        minHeight: 280,\n        p: 2,\n        border: "1px solid",\n        borderColor: "divider",\n        borderRadius: 1.5\n      }}\n    >\n      <Typography variant="body2" color="text.secondary">\n        กำลังเตรียมเครื่องมือจัดรูปแบบเพิ่มเติม…\n      </Typography>\n    </Box>\n  );\n}\n\nexport default function RichTextEditorImpl(props: RichTextEditorProps) {\n  const [advancedModeRequested, setAdvancedModeRequested] = useState(() =>\n    richTextDocumentNeedsAdvancedMode(props.value)\n  );\n  const [pendingAdvancedCommand, setPendingAdvancedCommand] = useState<PendingAdvancedCommand | null>(null);\n  const advancedModeEnabled = advancedModeRequested || richTextDocumentNeedsAdvancedMode(props.value);\n\n  if (advancedModeEnabled) {\n    return (\n      <Suspense fallback={<OptionalModeFallback />}>\n        <RichTextEditorOptionalMode\n          {...props}\n          pendingAdvancedCommand={pendingAdvancedCommand}\n          onAdvancedCommandApplied={() => setPendingAdvancedCommand(null)}\n        />\n      </Suspense>\n    );\n  }\n\n  return (\n    <RichTextEditorCore\n      {...props}\n      onRequestAdvancedSupport={(request) => {\n        setPendingAdvancedCommand(request);\n        setAdvancedModeRequested(true);\n      }}\n    />\n  );\n}\n`;
writeFileSync(implPath, wrapperSource);

const optionalModeSource = `import { Blockquote } from "@tiptap/extension-blockquote";\nimport Highlight from "@tiptap/extension-highlight";\nimport { HorizontalRule } from "@tiptap/extension-horizontal-rule";\nimport { Link } from "@tiptap/extension-link";\nimport { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";\nimport { Strike } from "@tiptap/extension-strike";\nimport { TableKit } from "@tiptap/extension-table";\nimport TextAlign from "@tiptap/extension-text-align";\nimport { Color, TextStyle } from "@tiptap/extension-text-style";\nimport { Underline } from "@tiptap/extension-underline";\nimport RichTextEditorCore, { type RichTextEditorCoreProps } from "./RichTextEditorCore";\n\nconst advancedExtensions = [\n  Blockquote,\n  BulletList,\n  HorizontalRule,\n  Link,\n  ListItem,\n  ListKeymap,\n  OrderedList,\n  Strike,\n  Underline,\n  TextStyle,\n  Color,\n  Highlight.configure({ multicolor: true }),\n  TextAlign.configure({\n    types: ["heading", "paragraph"],\n    alignments: ["left", "center", "right", "justify"]\n  }),\n  TableKit.configure({\n    table: {\n      resizable: true\n    }\n  })\n];\n\ntype RichTextEditorOptionalModeProps = Omit<\n  RichTextEditorCoreProps,\n  "additionalExtensions" | "advancedSupportEnabled" | "onRequestAdvancedSupport"\n>;\n\nexport default function RichTextEditorOptionalMode(props: RichTextEditorOptionalModeProps) {\n  return <RichTextEditorCore {...props} additionalExtensions={advancedExtensions} advancedSupportEnabled />;\n}\n`;
writeFileSync(optionalModePath, optionalModeSource);

const parityPath = "src/admin/components/richTextEditorParity.test.ts";
let paritySource = readFileSync(parityPath, "utf8");
paritySource = replaceOnce(
  paritySource,
  `    const source = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");\n\n    expect(source).not.toContain("@tiptap/starter-kit");`,
  `    const wrapperSource = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");\n    const coreSource = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorCore.tsx"), "utf8");\n    const optionalModeSource = readFileSync(\n      resolve(process.cwd(), "src/admin/components/RichTextEditorOptionalMode.tsx"),\n      "utf8"\n    );\n\n    expect(wrapperSource).toContain('lazy(() => import("./RichTextEditorOptionalMode"))');\n    expect(coreSource).not.toContain("@tiptap/starter-kit");\n    for (const deferredPackage of [\n      "@tiptap/extension-blockquote",\n      "@tiptap/extension-highlight",\n      "@tiptap/extension-horizontal-rule",\n      "@tiptap/extension-link",\n      "@tiptap/extension-list",\n      "@tiptap/extension-strike",\n      "@tiptap/extension-table",\n      "@tiptap/extension-text-align",\n      "@tiptap/extension-text-style",\n      "@tiptap/extension-underline"\n    ]) {\n      expect(coreSource).not.toContain(deferredPackage);\n      expect(optionalModeSource).toContain(deferredPackage);\n    }`,
  "parity source setup"
);
paritySource = paritySource.replaceAll("      expect(source).toContain(requiredToken);", "      expect(`${coreSource}\\n${optionalModeSource}`).toContain(requiredToken);");
writeFileSync(parityPath, paritySource);

const packagePath = "package.json";
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
packageJson.scripts["editor:bundle:check"] = "node scripts/check-admin-editor-bundle.mjs";
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const ciPath = ".github/workflows/ci.yml";
let ciSource = readFileSync(ciPath, "utf8");
ciSource = replaceOnce(
  ciSource,
  "      - run: pnpm perf:check\n      - run: pnpm media:check",
  "      - run: pnpm perf:check\n      - run: pnpm editor:bundle:check\n      - run: pnpm media:check",
  "Governance performance step"
);
writeFileSync(ciPath, ciSource);

const trackerPath = "docs/workstreams/v3.3.2-content-editor-performance-tracker.md";
let trackerSource = readFileSync(trackerPath, "utf8");
trackerSource = trackerSource
  .replace("| 6                       | Editor Behavior Parity                                    | IN PROGRESS | branch open      |", "| 6                       | Editor Behavior Parity                                    | COMPLETE    | #515 PASS        |")
  .replace("| 7                       | Admin Bundle Governance                                   | PENDING     | pending          |", "| 7                       | Admin Bundle Governance                                   | IN PROGRESS | branch open      |");
writeFileSync(trackerPath, trackerSource);
