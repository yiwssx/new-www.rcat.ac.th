import { describe, expect, it } from "vitest";
import {
  analyzeEditorDependencyIsolation,
  collectChunkGraphModuleIds,
  EDITOR_RUNTIME_MODULE_PATTERNS,
  findEditorRuntimeAssociations,
  formatEditorDependencyIsolationReport,
  normalizeEditorModuleId
} from "./editor-dependency-isolation.mjs";

function chunk(fileName, modules) {
  return {
    type: "chunk",
    fileName,
    modules: Object.fromEntries(modules.map((moduleId) => [moduleId, {}]))
  };
}

describe("editor dependency isolation", () => {
  it("normalizes module ids and recognizes both Tiptap and ProseMirror packages", () => {
    expect(normalizeEditorModuleId("\0C:\\repo\\node_modules\\@tiptap\\react\\dist\\index.js")).toBe(
      "C:/repo/node_modules/@tiptap/react/dist/index.js"
    );
    expect(EDITOR_RUNTIME_MODULE_PATTERNS).toEqual(["/node_modules/@tiptap/", "/node_modules/prosemirror-"]);

    expect(
      findEditorRuntimeAssociations([
        "/repo/src/main.tsx",
        "/repo/node_modules/@tiptap/core/dist/index.js",
        "/repo/node_modules/prosemirror-state/dist/index.js"
      ])
    ).toEqual(["/repo/node_modules/@tiptap/core/dist/index.js", "/repo/node_modules/prosemirror-state/dist/index.js"]);
  });

  it("collects unique module ids from a static chunk graph and fails closed for missing associations", () => {
    const chunksByFile = new Map([
      [
        "assets/content.js",
        chunk("assets/content.js", ["/repo/src/admin/pages/ContentPage.tsx", "/repo/src/shared.ts"])
      ],
      ["assets/shared.js", chunk("assets/shared.js", ["/repo/src/shared.ts", "/repo/src/api.ts"])]
    ]);

    expect(collectChunkGraphModuleIds(chunksByFile, new Set(["assets/content.js", "assets/shared.js"]))).toEqual([
      "/repo/src/admin/pages/ContentPage.tsx",
      "/repo/src/api.ts",
      "/repo/src/shared.ts"
    ]);

    expect(() => collectChunkGraphModuleIds(chunksByFile, new Set(["assets/missing.js"]))).toThrow(
      /Missing emitted chunk assets\/missing\.js/u
    );
    expect(() =>
      collectChunkGraphModuleIds(
        new Map([["assets/empty.js", { type: "chunk", fileName: "assets/empty.js", modules: {} }]]),
        new Set(["assets/empty.js"])
      )
    ).toThrow(/missing module associations/u);
  });

  it("passes only when editor runtimes are absent from both protected graphs", () => {
    expect(
      analyzeEditorDependencyIsolation({
        publicModuleIds: ["/repo/src/main.tsx"],
        adminContentModuleIds: ["/repo/src/admin/pages/ContentPage.tsx"]
      })
    ).toEqual({
      publicAssociations: [],
      adminContentAssociations: [],
      passed: true
    });
  });

  it("reports leaks independently for the public and initial admin-content graphs", () => {
    const result = analyzeEditorDependencyIsolation({
      publicModuleIds: ["/repo/node_modules/@tiptap/core/dist/index.js"],
      adminContentModuleIds: ["C:\\repo\\node_modules\\prosemirror-model\\dist\\index.js"]
    });
    const report = formatEditorDependencyIsolationReport(result);

    expect(result.passed).toBe(false);
    expect(result.publicAssociations).toEqual(["/repo/node_modules/@tiptap/core/dist/index.js"]);
    expect(result.adminContentAssociations).toEqual(["C:/repo/node_modules/prosemirror-model/dist/index.js"]);
    expect(report).toContain("Public synchronous graph: Tiptap/ProseMirror leak; FAIL");
    expect(report).toContain("Initial /admin/content graph: Tiptap/ProseMirror leak; FAIL");
    expect(report).toContain("Editor dependency isolation result: FAIL");
  });
});
