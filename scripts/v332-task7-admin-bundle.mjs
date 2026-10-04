import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Task 7 transform could not find ${label}.`);
  }
  return source.replace(before, after);
}

const implPath = "src/admin/components/RichTextEditorImpl.tsx";
const corePath = "src/admin/components/RichTextEditorCore.tsx";
const tableModePath = "src/admin/components/RichTextEditorTableMode.tsx";
let coreSource = readFileSync(implPath, "utf8");

coreSource = replaceOnce(
  coreSource,
  'import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";\n',
  'import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from "react";\nimport type { Extensions } from "@tiptap/core";\n',
  "Tiptap extension type import"
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
  `export interface RichTextEditorCoreProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n  additionalExtensions?: Extensions;\n  tableSupportEnabled?: boolean;\n  insertTableOnCreateAt?: number | null;\n  onRequestTableSupport?: (position: number) => void;\n  onTableInserted?: () => void;\n}`,
  "core props"
);
coreSource = replaceOnce(
  coreSource,
  `export default function RichTextEditor({ value, onChange, onInsertBlock }: RichTextEditorProps) {`,
  `export default function RichTextEditorCore({\n  value,\n  onChange,\n  onInsertBlock,\n  additionalExtensions = [],\n  tableSupportEnabled = false,\n  insertTableOnCreateAt = null,\n  onRequestTableSupport,\n  onTableInserted\n}: RichTextEditorCoreProps) {`,
  "core component signature"
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
  `    onCreate: ({ editor: currentEditor }) => {\n      if (tableSupportEnabled && insertTableOnCreateAt !== null) {\n        currentEditor\n          .chain()\n          .focus()\n          .setTextSelection(insertTableOnCreateAt)\n          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })\n          .run();\n        onTableInserted?.();\n      }\n    },\n    onUpdate: ({ editor: currentEditor }) => {\n      onChange(normalizeRichTextDocument(currentEditor.getJSON()));\n    }\n  });`,
  "editor onCreate hook"
);
coreSource = replaceOnce(
  coreSource,
  `    if (command === "table") {\n      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      return;\n    }`,
  `    if (command === "table") {\n      if (!tableSupportEnabled) {\n        onRequestTableSupport?.(editor.state.selection.from);\n        return;\n      }\n\n      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();\n      return;\n    }`,
  "table insertion command"
);
coreSource = replaceOnce(
  coreSource,
  `{editor.isActive("table") && (`,
  `{tableSupportEnabled && editor.isActive("table") && (`,
  "table toolbar guard"
);
writeFileSync(corePath, coreSource);

const wrapperSource = `import { lazy, Suspense, useState } from "react";\nimport Box from "@mui/material/Box";\nimport Typography from "@mui/material/Typography";\nimport type { RichTextDocument } from "../../utils/contentBlocks";\nimport type { RichTextExternalInsertRequest } from "./richTextInsert";\nimport RichTextEditorCore from "./RichTextEditorCore";\n\nconst RichTextEditorTableMode = lazy(() => import("./RichTextEditorTableMode"));\n\ninterface RichTextEditorProps {\n  value: RichTextDocument;\n  onChange: (value: RichTextDocument) => void;\n  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;\n}\n\nfunction richTextNodeContainsTable(node: unknown): boolean {\n  if (!node || typeof node !== "object") {\n    return false;\n  }\n\n  const record = node as { type?: unknown; content?: unknown };\n  if (record.type === "table") {\n    return true;\n  }\n\n  return Array.isArray(record.content) && record.content.some(richTextNodeContainsTable);\n}\n\nexport function richTextDocumentHasTable(document: RichTextDocument) {\n  return richTextNodeContainsTable(document);\n}\n\nfunction TableModeFallback() {\n  return (\n    <Box\n      sx={{\n        minHeight: 280,\n        p: 2,\n        border: "1px solid",\n        borderColor: "divider",\n        borderRadius: 1.5\n      }}\n    >\n      <Typography variant="body2" color="text.secondary">\n        กำลังเตรียมเครื่องมือตาราง…\n      </Typography>\n    </Box>\n  );\n}\n\nexport default function RichTextEditorImpl(props: RichTextEditorProps) {\n  const [tableModeRequested, setTableModeRequested] = useState(() => richTextDocumentHasTable(props.value));\n  const [pendingTableInsertAt, setPendingTableInsertAt] = useState<number | null>(null);\n  const tableModeEnabled = tableModeRequested || richTextDocumentHasTable(props.value);\n\n  if (tableModeEnabled) {\n    return (\n      <Suspense fallback={<TableModeFallback />}>\n        <RichTextEditorTableMode\n          {...props}\n          insertTableOnCreateAt={pendingTableInsertAt}\n          onTableInserted={() => setPendingTableInsertAt(null)}\n        />\n      </Suspense>\n    );\n  }\n\n  return (\n    <RichTextEditorCore\n      {...props}\n      onRequestTableSupport={(position) => {\n        setPendingTableInsertAt(position);\n        setTableModeRequested(true);\n      }}\n    />\n  );\n}\n`;
writeFileSync(implPath, wrapperSource);

const tableModeSource = `import { TableKit } from "@tiptap/extension-table";\nimport RichTextEditorCore, { type RichTextEditorCoreProps } from "./RichTextEditorCore";\n\nconst tableExtensions = [\n  TableKit.configure({\n    table: {\n      resizable: true\n    }\n  })\n];\n\ntype RichTextEditorTableModeProps = Omit<\n  RichTextEditorCoreProps,\n  "additionalExtensions" | "tableSupportEnabled" | "onRequestTableSupport"\n>;\n\nexport default function RichTextEditorTableMode(props: RichTextEditorTableModeProps) {\n  return <RichTextEditorCore {...props} additionalExtensions={tableExtensions} tableSupportEnabled />;\n}\n`;
writeFileSync(tableModePath, tableModeSource);

const parityPath = "src/admin/components/richTextEditorParity.test.ts";
let paritySource = readFileSync(parityPath, "utf8");
paritySource = replaceOnce(
  paritySource,
  `    const source = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");\n\n    expect(source).not.toContain("@tiptap/starter-kit");`,
  `    const wrapperSource = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorImpl.tsx"), "utf8");\n    const coreSource = readFileSync(resolve(process.cwd(), "src/admin/components/RichTextEditorCore.tsx"), "utf8");\n    const tableModeSource = readFileSync(\n      resolve(process.cwd(), "src/admin/components/RichTextEditorTableMode.tsx"),\n      "utf8"\n    );\n\n    expect(wrapperSource).toContain('lazy(() => import("./RichTextEditorTableMode"))');\n    expect(coreSource).not.toContain("@tiptap/starter-kit");\n    expect(coreSource).not.toContain("@tiptap/extension-table");\n    expect(tableModeSource).toContain('from "@tiptap/extension-table"');\n    expect(tableModeSource).toContain("TableKit.configure");`,
  "parity source setup"
);
paritySource = paritySource.replaceAll("      expect(source).toContain(requiredToken);", "      expect(coreSource).toContain(requiredToken);");
paritySource = paritySource.replace(
  '      "TableKit.configure",\n',
  ""
);
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
