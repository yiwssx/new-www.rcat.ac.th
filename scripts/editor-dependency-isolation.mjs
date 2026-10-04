export const EDITOR_RUNTIME_MODULE_PATTERNS = Object.freeze([
  "/node_modules/@tiptap/",
  "/node_modules/prosemirror-"
]);

export function normalizeEditorModuleId(moduleId) {
  return String(moduleId ?? "").replaceAll("\\", "/").replace(/^\0/u, "");
}

export function collectChunkGraphModuleIds(chunksByFile, chunkFiles) {
  const moduleIds = new Set();

  for (const fileName of chunkFiles) {
    const chunk = chunksByFile.get(fileName);
    if (!chunk) {
      throw new Error(`Missing emitted chunk ${fileName} while checking editor dependency isolation.`);
    }

    const moduleEntries = Object.keys(chunk.modules ?? {});
    if (moduleEntries.length === 0) {
      throw new Error(`Vite output chunk ${fileName} is missing module associations.`);
    }

    for (const moduleId of moduleEntries) {
      moduleIds.add(normalizeEditorModuleId(moduleId));
    }
  }

  return [...moduleIds].sort();
}

export function findEditorRuntimeAssociations(moduleIds, patterns = EDITOR_RUNTIME_MODULE_PATTERNS) {
  const normalizedPatterns = patterns.map(normalizeEditorModuleId);
  const normalizedModuleIds = moduleIds.map(normalizeEditorModuleId);

  return normalizedModuleIds.filter((moduleId) =>
    normalizedPatterns.some((pattern) => moduleId.includes(pattern))
  );
}

export function analyzeEditorDependencyIsolation({ publicModuleIds, adminContentModuleIds }) {
  const publicAssociations = findEditorRuntimeAssociations(publicModuleIds);
  const adminContentAssociations = findEditorRuntimeAssociations(adminContentModuleIds);

  return {
    publicAssociations,
    adminContentAssociations,
    passed: publicAssociations.length === 0 && adminContentAssociations.length === 0
  };
}

export function formatEditorDependencyIsolationReport(result) {
  const lines = ["Editor dependency isolation evidence:"];

  if (result.publicAssociations.length === 0) {
    lines.push("- Public synchronous graph: no Tiptap/ProseMirror modules; PASS");
  } else {
    lines.push("- Public synchronous graph: Tiptap/ProseMirror leak; FAIL");
    for (const moduleId of result.publicAssociations) {
      lines.push(`  - ${moduleId}`);
    }
  }

  if (result.adminContentAssociations.length === 0) {
    lines.push("- Initial /admin/content graph: no Tiptap/ProseMirror modules; PASS");
  } else {
    lines.push("- Initial /admin/content graph: Tiptap/ProseMirror leak; FAIL");
    for (const moduleId of result.adminContentAssociations) {
      lines.push(`  - ${moduleId}`);
    }
  }

  lines.push(`Editor dependency isolation result: ${result.passed ? "PASS" : "FAIL"}`);
  return lines.join("\n");
}
