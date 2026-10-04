import { readFileSync, writeFileSync } from "node:fs";

const packagePath = "package.json";
const editorPath = "src/admin/components/RichTextEditorImpl.tsx";

const directEditorDependencies = [
  "@tiptap/core",
  "@tiptap/extension-blockquote",
  "@tiptap/extension-bold",
  "@tiptap/extension-document",
  "@tiptap/extension-hard-break",
  "@tiptap/extension-heading",
  "@tiptap/extension-horizontal-rule",
  "@tiptap/extension-italic",
  "@tiptap/extension-link",
  "@tiptap/extension-list",
  "@tiptap/extension-paragraph",
  "@tiptap/extension-strike",
  "@tiptap/extension-text",
  "@tiptap/extension-underline",
  "@tiptap/extensions"
];

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const dependencies = { ...packageJson.dependencies };
delete dependencies["@tiptap/starter-kit"];
for (const name of directEditorDependencies) {
  dependencies[name] = "3.31.3";
}
packageJson.dependencies = Object.fromEntries(Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)));
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

let editorSource = readFileSync(editorPath, "utf8");
const starterImport = 'import { StarterKit } from "@tiptap/starter-kit";';
const explicitImports = `import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Heading } from "@tiptap/extension-heading";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { Underline } from "@tiptap/extension-underline";
import { UndoRedo } from "@tiptap/extensions";`;

if (!editorSource.includes(starterImport)) {
  throw new Error("Task 3 transform could not find the StarterKit import.");
}
editorSource = editorSource.replace(starterImport, explicitImports);

const starterConfig = `      StarterKit.configure({
        heading: {
          levels: [2, 3, 4]
        }
      }),`;
const leanExtensions = `      Bold,
      Blockquote,
      BulletList,
      Document,
      HardBreak,
      Heading.configure({
        levels: [2, 3, 4]
      }),
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
      Underline,`;

if (!editorSource.includes(starterConfig)) {
  throw new Error("Task 3 transform could not find the StarterKit configuration.");
}
editorSource = editorSource.replace(starterConfig, leanExtensions);
writeFileSync(editorPath, editorSource);
