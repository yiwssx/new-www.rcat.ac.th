// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const srcRoot = join(repositoryRoot, "src");
const entryFile = join(srcRoot, "main.tsx");
const publicRouteEntryFiles = [
  "PublicHomePage.tsx",
  "PublicDepartmentsPage.tsx",
  "PublicNewsPage.tsx",
  "PublicAnnouncementsPage.tsx",
  "PublicAchievementsPage.tsx",
  "PublicBlogPage.tsx",
  "PublicDocumentsPage.tsx",
  "PublicCalendarPage.tsx",
  "PublicContactPage.tsx",
  "PublicSearchPage.tsx",
  "PublicContentDetailPage.tsx"
].map((filename) => join(srcRoot, "public", "pages", filename));
const moduleExtensions = [".ts", ".tsx", ".js", ".mjs"] as const;

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

function staticRelativeImports(path: string) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];

  source.forEachChild((node) => {
    const isRuntimeImportDeclaration = ts.isImportDeclaration(node) && isRuntimeImport(node);
    const isRuntimeExportDeclaration = ts.isExportDeclaration(node) && !node.isTypeOnly;

    if (
      (isRuntimeImportDeclaration || isRuntimeExportDeclaration) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith(".")
    ) {
      const resolved = resolveRelativeModule(path, node.moduleSpecifier.text);

      if (resolved) {
        imports.push(resolved);
      }
    }
  });

  return imports;
}

function collectStaticEntryGraph(path: string, visited = new Set<string>()) {
  if (visited.has(path)) {
    return visited;
  }

  visited.add(path);

  for (const importedPath of staticRelativeImports(path)) {
    collectStaticEntryGraph(importedPath, visited);
  }

  return visited;
}

describe("Public entry CMS Auth import boundary", () => {
  it("keeps Auth, Recovery Code, reauthentication, capability, and Admin modules out of the static entry graph", () => {
    const visited = collectStaticEntryGraph(entryFile);

    for (const publicRouteEntry of publicRouteEntryFiles) {
      collectStaticEntryGraph(publicRouteEntry, visited);
    }

    const staticGraph = [...visited].map((path) => relative(repositoryRoot, path).replace(/\\/g, "/"));
    const forbiddenStaticModules = [
      "src/cmsAuthRouteComponents.tsx",
      "src/context/AuthContext.tsx",
      "src/context/RecoveryCodeHandoffContext.tsx",
      "src/context/RecoveryCodeHandoffProvider.tsx",
      "src/context/authSessionContext.tsx",
      "src/features/cms-auth/",
      "src/admin/components/RecoveryCode",
      "src/admin/components/ReauthenticationDialog.tsx",
      "src/admin/layout/CmsShell.tsx",
      "src/admin/pages/"
    ];

    expect(staticGraph).toContain("src/App.tsx");
    expect(staticGraph).toContain("src/routes.tsx");
    expect(staticGraph).toContain("src/routeComponents.tsx");

    for (const forbiddenModule of forbiddenStaticModules) {
      expect(
        staticGraph.some((path) => path === forbiddenModule || path.startsWith(forbiddenModule)),
        `${forbiddenModule} must remain behind the lazy CMS Auth route boundary`
      ).toBe(false);
    }
  });

  it("keeps the CMS Auth route implementation reachable only through a dynamic import", () => {
    const routeComponentsPath = join(srcRoot, "routeComponents.tsx");
    const source = ts.createSourceFile(
      routeComponentsPath,
      readFileSync(routeComponentsPath, "utf8"),
      ts.ScriptTarget.Latest,
      true
    );
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

    expect(staticSpecifiers).not.toContain("./cmsAuthRouteComponents");
    expect(dynamicSpecifiers).toContain("./cmsAuthRouteComponents");
  });
});
