let contentEditorDialogPromise: Promise<typeof import("./ContentEditorDialog")> | null = null;
let richTextEditorImplPromise: Promise<typeof import("./RichTextEditorImpl")> | null = null;

export function loadContentEditorDialog() {
  contentEditorDialogPromise ??= import("./ContentEditorDialog");
  return contentEditorDialogPromise;
}

export function loadRichTextEditorImpl() {
  richTextEditorImplPromise ??= import("./RichTextEditorImpl");
  return richTextEditorImplPromise;
}

export function preloadContentEditorModules() {
  void loadContentEditorDialog();
  void loadRichTextEditorImpl();
}
