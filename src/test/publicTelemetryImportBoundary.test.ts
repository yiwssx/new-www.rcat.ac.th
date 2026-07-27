// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const srcRoot = join(repositoryRoot, "src");
const entryFile = join(srcRoot, "main.tsx");
const moduleExtensions = [".ts", ".tsx", ".js", ".mjs"] as const;

interface StaticGraph {
  files: Set<string>;
  externalSpecifiers: Set<string>;
}

function resolveRelativeModule(importer: string, specifier: string) {
  const candidate = resolve(dirname(importer), specifier);
  const candidates = extname(candidate)
    ? [candidate]
    : [
        ...moduleExtensions.map((extension) => `${candidate}${extension}`),
        ...moduleExtensions.map((extension) => join(candidate, `index${extension}`))
      ];

  return candidates.find((path) => existsSync(path));
}

function isRuntimeImport(node: ts.ImportDeclaration) {
  const clause = node.importClause;

  if (!clause) {
    return true;
  }

  if (clause.isTypeOnly) {
    return false;
  }

  if (clause.name) {
    return true;
  }

  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    return !clause.namedBindings.elements.every((element) => element.isTypeOnly);
  }

  return true;
}

function collectStaticGraph(path: string, graph: StaticGraph = { files: new Set(), externalSpecifiers: new Set() }) {
  if (graph.files.has(path)) {
    return graph;
  }

  graph.files.add(path);
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);

  source.forEachChild((node) => {
    const isRuntimeImportDeclaration = ts.isImportDeclaration(node) && isRuntimeImport(node);
    const isRuntimeExportDeclaration = ts.isExportDeclaration(node) && !node.isTypeOnly;

    if (
      !(isRuntimeImportDeclaration || isRuntimeExportDeclaration) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier)
    ) {
      return;
    }

    const specifier = node.moduleSpecifier.text;

    if (!specifier.startsWith(".")) {
      graph.externalSpecifiers.add(specifier);
      return;
    }

    const importedPath = resolveRelativeModule(path, specifier);

    if (importedPath) {
      collectStaticGraph(importedPath, graph);
    }
  });

  return graph;
}

function moduleSpecifiers(path: string) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const staticSpecifiers: string[] = [];
  const dynamicSpecifiers: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      staticSpecifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      dynamicSpecifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return { staticSpecifiers, dynamicSpecifiers };
}

function relativeGraphFiles(graph: StaticGraph) {
  return [...graph.files].map((path) => relative(repositoryRoot, path).replace(/\\/gu, "/"));
}

describe("Public telemetry import boundary", () => {
  it("keeps telemetry implementations and vendors out of the synchronous application entry graph", () => {
    const graph = collectStaticGraph(entryFile);
    const staticFiles = relativeGraphFiles(graph);
    const forbiddenStaticModules = [
      "src/shared/telemetry/PublicTelemetry.tsx",
      "src/shared/components/PublicAnalytics.tsx",
      "src/shared/components/VercelInsights.tsx",
      "src/shared/utils/publicAnalytics.ts",
      "src/features/site-view/"
    ];

    expect(staticFiles).toContain("src/routeComponents.tsx");
    expect(staticFiles).toContain("src/shared/telemetry/SilentTelemetryBoundary.tsx");

    for (const forbiddenModule of forbiddenStaticModules) {
      expect(
        staticFiles.some((path) => path === forbiddenModule || path.startsWith(forbiddenModule)),
        `${forbiddenModule} must stay behind the dynamic Public telemetry boundary`
      ).toBe(false);
    }

    expect(graph.externalSpecifiers).not.toContain("@vercel/analytics/react");
    expect(graph.externalSpecifiers).not.toContain("@vercel/speed-insights/react");
  });

  it("loads the telemetry implementation only through the Public route dynamic import", () => {
    const routeComponentsPath = join(srcRoot, "routeComponents.tsx");
    const { staticSpecifiers, dynamicSpecifiers } = moduleSpecifiers(routeComponentsPath);

    expect(staticSpecifiers).not.toContain("./shared/telemetry/PublicTelemetry");
    expect(dynamicSpecifiers).toContain("./shared/telemetry/PublicTelemetry");
  });

  it("keeps the lazy telemetry graph reachable without importing the route registry back", () => {
    const publicTelemetryPath = join(srcRoot, "shared", "telemetry", "PublicTelemetry.tsx");
    const graph = collectStaticGraph(publicTelemetryPath);
    const staticFiles = relativeGraphFiles(graph);

    expect(staticFiles).toContain("src/shared/components/PublicAnalytics.tsx");
    expect(staticFiles).toContain("src/shared/components/VercelInsights.tsx");
    expect(staticFiles).toContain("src/features/site-view/PublicSiteViewTracker.tsx");
    expect(staticFiles).not.toContain("src/routeComponents.tsx");
    expect(staticFiles).not.toContain("src/routes.tsx");
    expect(graph.externalSpecifiers).toContain("@vercel/analytics/react");
    expect(graph.externalSpecifiers).toContain("@vercel/speed-insights/react");
  });
});
