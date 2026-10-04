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
coreSource = replaceOnce(
  coreSource,
  'import { HorizontalRule } from "@tiptap/extension-horizontal-rule";\n',
  "",
  "static HorizontalRule import"
);
coreSource = replaceOnce(
  coreSource,
  'import { TableKit } from "@tiptap/extension-table";\n',
  "",
  "static TableKit import"
);
coreSource = replaceOnce(
  coreSource,
  `interface RichTextEditorProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n}`,
  `export interface RichTextEditorCoreProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n  additionalExtensions?: Extensions;\n  optionalContentSupportEnabled?: boolean;\n  insertOptionalOnCreate?: { command: InternalInsertCommand; position: number } | null;\n  onRequestOptionalContentSupport?: (request: { command: InternalInsertCommand; position: number }) => void;\n  onOptionalInserted?: () => void;\n}`,
  "core props"
);
coreSource = replaceOnce(
  coreSource,
  'type InternalInsertCommand = "table" | "horizontalRule";',
  'export type InternalInsertCommand = "table" | "horizontalRule";',
  "internal insert command type"
);
coreSource = replaceOnce(
  coreSource,
  `export default function RichTextEditor({ value, onChange, onInsertBlock }: RichTextEditorProps) {`,
  `export default function RichTextEditorCore({\n  value,\n  onChange,\n  onInsertBlock,\n  additionalExtensions = [],\n  optionalContentSupportEnabled = false,\n  insertOptionalOnCreate = null,\n  onRequestOptionalContentSupport,\n  onOptionalInserted\n}: RichTextEditorCoreProps) {`,
  "core component signature"
);
coreSource = replaceOnce(
  coreSource,
  `      Heading.configure({\n        levels: [2, 3, 4]\n      }),\n      UndoRedo,\n      HorizontalRule,\n      Italic,`,
  `      Heading.configure({\n        levels: [2, 3, 4]\n      }),\n      UndoRedo,\n      Italic,`,
  "HorizontalRule extension registration"
);
coreSource = replaceOnce(
  coreSource,
  `      TextAlign.configure({\n        types: ["heading", "paragraph"],\n        alignments: ["left", "center", "right", "justify"]\n      }),\n      TableKit.configure({\n        table: {\n          resizable: true\n        }\n      })\n    ],`,
  `      TextAlign.configure({\n        types: ["heading", "paragraph"],\n        alignments: ["left", "center", "right", "justify"]\n      }),\n      ...additionalExtensions\n    ],`,
  "TableKit extension block"
);
coreSource = replaceOnce(
  coreSource,
  `    onUpdate: ({ editor: currentEditor }) => {\n      onChange(normalizeRichTextDocument(currentEditor.getJSON()));\n    }\n  });`,
  `    onCreate: ({ editor: currentEditor }) => {\n      if (!optionalContentSupportEnabled || insertOptionalOnCreate === null) {\n        return;\n      }\n\n      const chain = currentEditor.chain().focus().setTextSelection(insertOptionalOnCreate.position);\n      if (insertOptionalOnCreate.command === "table") {\n        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      } else {\n        chain.setHorizontalRule().run();\n      }\n      onOptionalInserted?.();\n    },\n    onUpdate: ({ editor: currentEditor }) => {\n      onChange(normalizeRichTextDocument(currentEditor.getJSON()));\n    }\n  });`,
  "editor onCreate hook"
);
coreSource = replaceOnce(
  coreSource,
  `    if (command === "table") {\n      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      return;\n    }\n\n    editor.chain().focus().setHorizontalRule().run();`,
  `    if (!optionalContentSupportEnabled) {\n      onRequestOptionalContentSupport?.({ command, position: editor.state.selection.from });\n      return;\n    }\n\n    if (command === "table") {\n      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      return;\n    }\n\n    editor.chain().focus().setHorizontalRule().run();`,
  "optional insertion command"
);
coreSource = replaceOnce(
  coreSource,
  `{editor.isActive("table") && (`,
  `{optionalContentSupportEnabled && editor.isActive("table") && (`,
  "table toolbar guard"
);
writeFileSync(corePath, coreSource);

const wrapperSource = `import { lazy, Suspense, useState } from "react";\nimport Box from "@mui/material/Box";\nimport Typography from "@mui/material/Typography";\nimport type { RichTextDocument } from "../../utils/contentBlocks";\nimport type { RichTextExternalInsertRequest } from "./richTextInsert";\nimport RichTextEditorCore, { type InternalInsertCommand } from "./RichTextEditorCore";\n\nconst RichTextEditorOptionalMode = lazy(() => import("./RichTextEditorOptionalMode"));\n\ninterface RichTextEditorProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n}\n\ninterface PendingOptionalInsert {\n  command: InternalInsertCommand;\n  position: number;\n}\n\nfunction richTextNodeContainsOptionalContent(node: unknown): boolean {\n  if (!node || typeof node !== "object") {\n    return false;\n  }\n\n  const record = node as { type?: unknown; content?: unknown };\n  if (record.type === "table" || record.type === "horizontalRule") {\n    return true;\n  }\n\n  return Array.isArray(record.content) && record.content.some(richTextNodeContainsOptionalContent);\n}\n\nexport function richTextDocumentHasOptionalContent(document: RichTextDocument) {\n  return richTextNodeContainsOptionalContent(document);\n}\n\nfunction OptionalModeFallback() {\n  return (\n    <Box\n      sx={{\n        minHeight: 280,\n        p: 2,\n        border: "1px solid",\n        borderColor: "divider",\n        borderRadius: 1.5\n      }}\n    >\n      <Typography variant="body2" color="text.secondary">\n        กำลังเตรียมเครื่องมือแทรกขั้นสูง…\n      </Typography>\n    </Box>\n  );\n}\n\nexport default function RichTextEditorImpl(props: RichTextEditorProps) {\n  const [optionalModeRequested, setOptionalModeRequested] = useState(() =>\n    richTextDocumentHasOptionalContent(props.value)\n  );\n  const [pendingOptionalInsert, setPendingOptionalInsert] = useState<PendingOptionalInsert | null>(null);\n  const optionalModeEnabled = optionalModeRequested || richTextDocumentHasOptionalContent(props.value);\n\n  if (optionalModeEnabled) {\n    return (\n      <Suspense fallback={<OptionalModeFallback />}>\n        <RichTextEditorOptionalMode\n          {...props}\n          insertOptionalOnCreate={pendingOptionalInsert}\n          onOptionalInserted={() => setPendingOptionalInsert(null)}\n        />\n      </Suspense>\n    );\n  }\n\n  return (\n    <RichTextEditorCore\n      {...props}\n      onRequestOptionalContentSupport={(request) => {\n        setPendingOptionalInsert(request);\n        setOptionalModeRequested(true);\n      }}\n    />\n  );\n}\n`;
writeFileSync(implPath, wrapperSource);

const optionalModeSource = `import { HorizontalRule } from "@tiptap/extension-horizontal-rule";\nimport { TableKit } from "@tiptap/extension-table";\nimport RichTextEditorCore, { type RichTextEditorCoreProps } from "./RichTextEditorCore";\n\nconst optionalExtensions = [\n  HorizontalRule,\n  TableKit.configure({\n    table: {\n      resizable: true\n    }\n  })\n];\n\ntype RichTextEditorOptionalModeProps = Omit<\n  RichTextEditorCoreProps,\n  "additionalExtensions" | "optionalContentSupportEnabled" | "onRequestOptionalContentSupport"\n>;\n\nexport default function RichTextEditorOptionalMode(props: RichTextEditorOptionalModeProps) {\n  return <RichTextEditorCore {...props} additionalExtensions={optionalExtensions} optionalContentSupportEnabled />;\n}\n`;
writeFileSync(optionalModePath, optionalModeSource);

const parityPath = "src/admin/components/richTextEditorParity.test.ts";
let paritySource = readFileSync(parityPath, "utf8");
paritySource = replaceOnce(
  paritySource,
  `    const source = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");\n\n    expect(source).not.toContain("@tiptap/starter-kit");`,
  `    const wrapperSource = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");\n    const coreSource = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorCore.tsx"), "utf8");\n    const optionalModeSource = readFileSync(\n      resolve(process.cwd(), "src/admin/components/RichTextEditorOptionalMode.tsx"),\n      "utf8"\n    );\n\n    expect(wrapperSource).toContain('lazy(() => import("./RichTextEditorOptionalMode"))');\n    expect(coreSource).not.toContain("@tiptap/starter-kit");\n    expect(coreSource).not.toContain("@tiptap/extension-horizontal-rule");\n    expect(coreSource).not.toContain("@tiptap/extension-table");\n    expect(optionalModeSource).toContain('from "@tiptap/extension-horizontal-rule"');\n    expect(optionalModeSource).toContain('from "@tiptap/extension-table"');\n    expect(optionalModeSource).toContain("HorizontalRule");\n    expect(optionalModeSource).toContain("TableKit.configure");`,
  "parity source setup"
);
paritySource = paritySource.replaceAll("      expect(source).toContain(requiredToken);", "      expect(coreSource).toContain(requiredToken);");
paritySource = paritySource.replace('      "TableKit.configure",\n', "");
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
