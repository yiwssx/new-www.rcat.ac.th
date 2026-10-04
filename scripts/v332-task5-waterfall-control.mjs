import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Task 5 transform could not find ${label}.`);
  }
  return source.replace(before, after);
}

const richTextPath = "src/admin/components/RichTextEditor.tsx";
let richTextSource = readFileSync(richTextPath, "utf8");
richTextSource = replaceOnce(
  richTextSource,
  'import type { RichTextExternalInsertRequest } from "./richTextInsert";\n\nconst RichTextEditorImpl = lazy(() => import("./RichTextEditorImpl"));',
  'import type { RichTextExternalInsertRequest } from "./richTextInsert";\nimport { loadRichTextEditorImpl } from "./contentEditorModuleLoader";\n\nconst RichTextEditorImpl = lazy(loadRichTextEditorImpl);',
  "RichTextEditor lazy loader"
);
writeFileSync(richTextPath, richTextSource);

const pagePath = "src/admin/pages/ContentPage.tsx";
let pageSource = readFileSync(pagePath, "utf8");
pageSource = replaceOnce(
  pageSource,
  'import ContentWorkflowGuide from "../components/ContentWorkflowGuide";\nimport AdminPagination from "../components/AdminPagination";',
  'import ContentWorkflowGuide from "../components/ContentWorkflowGuide";\nimport { loadContentEditorDialog, preloadContentEditorModules } from "../components/contentEditorModuleLoader";\nimport AdminPagination from "../components/AdminPagination";',
  "ContentPage editor loader import"
);
pageSource = replaceOnce(
  pageSource,
  'const ContentEditorDialog = lazy(() => import("../components/ContentEditorDialog"));',
  "const ContentEditorDialog = lazy(loadContentEditorDialog);",
  "ContentEditorDialog lazy initializer"
);
pageSource = replaceOnce(
  pageSource,
  '      if (!canUpdate || contentWritePending || draftRecovery) {\n        return;\n      }\n\n      setSaveError("");',
  '      if (!canUpdate || contentWritePending || draftRecovery) {\n        return;\n      }\n\n      preloadContentEditorModules();\n      setSaveError("");',
  "edit preload point"
);
pageSource = replaceOnce(
  pageSource,
  '    if (!canCreate || contentWritePending || draftRecovery) {\n      return;\n    }\n\n    setSaveError("");',
  '    if (!canCreate || contentWritePending || draftRecovery) {\n      return;\n    }\n\n    preloadContentEditorModules();\n    setSaveError("");',
  "create preload point"
);
pageSource = replaceOnce(
  pageSource,
  '    if (!draftRecovery) {\n      return;\n    }\n\n    setSaveError("");',
  '    if (!draftRecovery) {\n      return;\n    }\n\n    preloadContentEditorModules();\n    setSaveError("");',
  "draft recovery preload point"
);
writeFileSync(pagePath, pageSource);

const testPath = "src/admin/pages/ContentPage.test.tsx";
let testSource = readFileSync(testPath, "utf8");
testSource = replaceOnce(
  testSource,
  'const contentMock = vi.hoisted(() => ({\n  saveContentItem: vi.fn(),\n  deleteContentItem: vi.fn(),\n  getAdminContentDetail: vi.fn(),\n  publishContent: vi.fn()\n}));\n\nconst publicInvalidationMock',
  'const contentMock = vi.hoisted(() => ({\n  saveContentItem: vi.fn(),\n  deleteContentItem: vi.fn(),\n  getAdminContentDetail: vi.fn(),\n  publishContent: vi.fn()\n}));\n\nconst editorLoaderMock = vi.hoisted(() => ({\n  preloadContentEditorModules: vi.fn()\n}));\n\nconst publicInvalidationMock',
  "editor loader test mock"
);
testSource = replaceOnce(
  testSource,
  'vi.mock("../../services/publicCmsInvalidation", () => ({',
  'vi.mock("../components/contentEditorModuleLoader", () => ({\n  loadContentEditorDialog: () => import("../components/ContentEditorDialog"),\n  preloadContentEditorModules: editorLoaderMock.preloadContentEditorModules\n}));\n\nvi.mock("../../services/publicCmsInvalidation", () => ({',
  "editor module loader mock registration"
);
testSource = replaceOnce(
  testSource,
  '    contentMock.publishContent.mockReset();\n    contentMock.publishContent.mockResolvedValue({ id: contentItem.id, published: true });',
  '    contentMock.publishContent.mockReset();\n    contentMock.publishContent.mockResolvedValue({ id: contentItem.id, published: true });\n    editorLoaderMock.preloadContentEditorModules.mockReset();',
  "editor loader mock reset"
);
testSource = replaceOnce(
  testSource,
  '  it("shows loading and an acknowledged success modal when saving content", async () => {',
  '  it("starts editor module preload as soon as edit intent begins", async () => {\n    const detail = deferred<ContentItem>();\n    contentMock.getAdminContentDetail.mockReturnValue(detail.promise);\n    renderContentPage();\n\n    await screen.findByText(contentItem.title);\n    expect(editorLoaderMock.preloadContentEditorModules).not.toHaveBeenCalled();\n\n    fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));\n\n    expect(editorLoaderMock.preloadContentEditorModules).toHaveBeenCalledTimes(1);\n    expect(contentMock.getAdminContentDetail).toHaveBeenCalledWith({ id: contentItem.id });\n    expect(screen.queryByRole("dialog", { name: "content-editor" })).not.toBeInTheDocument();\n\n    detail.resolve(contentItem);\n    expect(await screen.findByRole("dialog", { name: "content-editor" })).toBeInTheDocument();\n  });\n\n  it("shows loading and an acknowledged success modal when saving content", async () => {',
  "edit preload regression test"
);
writeFileSync(testPath, testSource);

const trackerPath = "docs/workstreams/v3.3.2-content-editor-performance-tracker.md";
let trackerSource = readFileSync(trackerPath, "utf8");
trackerSource = trackerSource
  .replace("| 2                       | Rich Text Lazy Boundary                                   | IN PROGRESS | branch open      |", "| 2                       | Rich Text Lazy Boundary                                   | COMPLETE    | #511 PASS        |")
  .replace("| 3                       | Tiptap Runtime Reduction                                  | PENDING     | pending          |", "| 3                       | Tiptap Runtime Reduction                                  | COMPLETE    | #512 PASS        |")
  .replace("| 4                       | Conditional Editor Features                               | PENDING     | pending          |", "| 4                       | Conditional Editor Features                               | COMPLETE    | #513 PASS        |")
  .replace("| 5                       | Loading Waterfall Control                                 | PENDING     | pending          |", "| 5                       | Loading Waterfall Control                                 | IN PROGRESS | branch open      |");
writeFileSync(trackerPath, trackerSource);
