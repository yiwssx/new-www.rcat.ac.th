import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  analyzePublicEntryBuild,
  collectStaticManifestEntries,
  evaluatePublicPerformanceBudget,
  PUBLIC_PERFORMANCE_REFERENCE,
  findIndexHtmlEntry,
  formatPublicPerformanceBudgetReport,
  parseViteManifestSource
} from "./public-performance-budget.mjs";

function chunk(fileName, code, modules) {
  return {
    type: "chunk",
    fileName,
    code,
    modules: Object.fromEntries(modules.map((moduleId) => [moduleId, {}]))
  };
}

function createFixture() {
  const manifest = {
    "index.html": {
      file: "assets/index.js",
      src: "index.html",
      isEntry: true,
      imports: ["_shared.js"],
      dynamicImports: ["src/shared/telemetry/PublicTelemetry.tsx"]
    },
    "_shared.js": {
      file: "assets/shared.js"
    },
    "src/shared/telemetry/PublicTelemetry.tsx": {
      file: "assets/PublicTelemetry.js",
      isDynamicEntry: true
    }
  };
  const outputChunks = [
    chunk("assets/index.js", "const greeting = 'สวัสดี';", ["/repo/src/main.tsx"]),
    chunk("assets/shared.js", "export const shared = true;", ["/repo/src/shared.ts"]),
    chunk("assets/PublicTelemetry.js", "export const telemetry = true;", [
      "/repo/src/shared/telemetry/PublicTelemetry.tsx",
      "/repo/node_modules/@vercel/analytics/dist/react/index.mjs"
    ])
  ];

  return { manifest, outputChunks };
}

describe("Public performance architecture calculator", () => {
  it("parses the manifest and identifies exactly one index.html entry", () => {
    const { manifest } = createFixture();

    expect(parseViteManifestSource(JSON.stringify(manifest))).toEqual(manifest);
    expect(findIndexHtmlEntry(manifest)).toMatchObject({
      key: "index.html",
      chunk: {
        file: "assets/index.js"
      }
    });
  });

  it("recursively follows static imports and ignores dynamic imports", () => {
    const { manifest } = createFixture();

    expect(collectStaticManifestEntries(manifest, "index.html")).toEqual(["index.html", "_shared.js"]);
  });

  it("calculates unique raw and gzip JavaScript bytes without associating lazy telemetry", () => {
    const { manifest, outputChunks } = createFixture();
    const metrics = analyzePublicEntryBuild({ manifest, outputChunks });
    const expectedCodes = [outputChunks[0].code, outputChunks[1].code];

    expect(metrics.javascriptFiles).toEqual(["assets/index.js", "assets/shared.js"]);
    expect(metrics.javascriptFileCount).toBe(2);
    expect(metrics.rawBytes).toBe(expectedCodes.reduce((total, code) => total + Buffer.byteLength(code), 0));
    expect(metrics.gzipBytes).toBe(
      expectedCodes.reduce((total, code) => total + gzipSync(Buffer.from(code), { level: 9 }).length, 0)
    );
    expect(metrics.forbiddenAssociations).toEqual([]);
    expect(metrics.moduleIds).not.toContain("/repo/src/shared/telemetry/PublicTelemetry.tsx");
  });

  it("fails closed for missing manifest imports, output chunks, or module associations", () => {
    const { manifest, outputChunks } = createFixture();

    expect(() =>
      collectStaticManifestEntries(
        {
          ...manifest,
          "index.html": {
            ...manifest["index.html"],
            imports: ["_missing.js"]
          }
        },
        "index.html"
      )
    ).toThrow(/_missing\.js/u);

    expect(() => analyzePublicEntryBuild({ manifest, outputChunks: outputChunks.slice(0, 1) })).toThrow(
      /assets\/shared\.js/u
    );
    expect(() =>
      analyzePublicEntryBuild({
        manifest,
        outputChunks: [
          {
            ...outputChunks[0],
            modules: {}
          },
          outputChunks[1]
        ]
      })
    ).toThrow(/module associations/u);
  });

  it("keeps static bundle measurements informational instead of treating them as Speed Insights thresholds", () => {
    expect(PUBLIC_PERFORMANCE_REFERENCE).toEqual({
      javascriptFiles: 14,
      rawBytes: 432_228,
      gzipBytes: 140_575
    });

    const result = evaluatePublicPerformanceBudget({
      javascriptFileCount: 99,
      rawBytes: 9_999_999,
      gzipBytes: 9_999_999,
      forbiddenAssociations: []
    });

    expect(result.passed).toBe(true);
    expect(result.observations.every((observation) => observation.difference > 0)).toBe(true);
  });

  it("hard-fails when telemetry crosses into the synchronous public entry graph", () => {
    const { manifest, outputChunks } = createFixture();
    outputChunks[0] = chunk("assets/index.js", outputChunks[0].code, [
      "/repo/src/main.tsx",
      "C:\\repo\\src\\shared\\components\\VercelInsights.tsx"
    ]);
    const metrics = analyzePublicEntryBuild({ manifest, outputChunks });
    const result = evaluatePublicPerformanceBudget(metrics);
    const report = formatPublicPerformanceBudgetReport(result);

    expect(result.passed).toBe(false);
    expect(result.forbiddenAssociations).toEqual(["/src/shared/components/VercelInsights.tsx"]);
    expect(report).toContain("reviewed reference");
    expect(report).toContain("Forbidden synchronous telemetry associations: FAIL");
    expect(report).toContain("Performance architecture result: FAIL");
  });
});
