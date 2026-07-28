import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const listingPageFiles = [
  "src/public/pages/PublicNewsPage.tsx",
  "src/public/pages/PublicAnnouncementsPage.tsx",
  "src/public/pages/PublicBlogPage.tsx",
  "src/public/pages/PublicAchievementsPage.tsx",
  "src/public/pages/PublicDepartmentsPage.tsx",
  "src/public/pages/PublicSearchPage.tsx"
];

function parseSource(path, source) {
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function nodeLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function jsxTagName(node) {
  const tag = node.tagName;

  if (ts.isIdentifier(tag)) {
    return tag.text;
  }

  return tag.getText();
}

function jsxAttributes(sourceFile) {
  const attributes = [];

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const property of node.attributes.properties) {
        if (ts.isJsxAttribute(property)) {
          attributes.push({
            name: property.name.getText(sourceFile),
            value: property.initializer?.getText(sourceFile) ?? "",
            node: property
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return attributes;
}

function jsxTags(sourceFile) {
  const tags = [];

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      tags.push({ name: jsxTagName(node), node });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return tags;
}

function importSpecifiers(sourceFile) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map((declaration) => declaration.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((specifier) => specifier.text);
}

function hasAttribute(attributes, name, valueFragment) {
  return attributes.some(
    (attribute) => attribute.name === name && (!valueFragment || attribute.value.includes(valueFragment))
  );
}

function createViolation(file, sourceFile, node, rule, message) {
  return {
    file,
    line: node ? nodeLine(sourceFile, node) : 1,
    rule,
    message
  };
}

export function scanPublicLayoutSource(file, source) {
  const sourceFile = parseSource(file, source);
  const attributes = jsxAttributes(sourceFile);
  const tags = jsxTags(sourceFile);
  const imports = importSpecifiers(sourceFile);
  const violations = [];

  if (file.endsWith("PublicFooterDirectory.tsx")) {
    for (const state of ["loading", "ready", "empty"]) {
      if (!hasAttribute(attributes, "data-footer-directory-state", state)) {
        violations.push(
          createViolation(
            file,
            sourceFile,
            sourceFile,
            "footer-directory-state",
            `Footer Directory must retain its ${state} state marker.`
          )
        );
      }
    }

    if (!hasAttribute(attributes, "data-cls-region", "footer-directory")) {
      violations.push(
        createViolation(
          file,
          sourceFile,
          sourceFile,
          "footer-directory-region",
          "Footer Directory must retain its stable CLS region marker."
        )
      );
    }

    if (!tags.some((tag) => tag.name === "FooterDirectoryPlaceholder")) {
      violations.push(
        createViolation(
          file,
          sourceFile,
          sourceFile,
          "footer-directory-placeholder",
          "Pending shell data must render the responsive Footer Directory placeholder."
        )
      );
    }
  }

  if (file.endsWith("PublicSiteShell.tsx") || file.endsWith("PublicFooterDirectory.tsx")) {
    const forbiddenImports = imports.filter((specifier) =>
      /(?:^|\/)(?:admin|cms-auth|auth|recovery)(?:\/|$)/iu.test(specifier)
    );

    for (const specifier of forbiddenImports) {
      violations.push(
        createViolation(
          file,
          sourceFile,
          sourceFile,
          "public-shell-import-boundary",
          `Public shell must not import Auth/Admin modules: ${specifier}`
        )
      );
    }
  }

  if (file.endsWith("PublicLoadingState.tsx")) {
    const structuredTags = new Set(tags.map((tag) => tag.name));

    if (
      !hasAttribute(attributes, "data-public-loading-variant") ||
      !structuredTags.has("Skeleton") ||
      !structuredTags.has("Grid")
    ) {
      violations.push(
        createViolation(
          file,
          sourceFile,
          sourceFile,
          "structured-public-loading",
          "Public loading must keep named variants with structured Skeleton and Grid geometry."
        )
      );
    }
  }

  if (listingPageFiles.includes(file.replaceAll("\\", "/"))) {
    if (!tags.some((tag) => tag.name === "PublicBackgroundProgress")) {
      violations.push(
        createViolation(
          file,
          sourceFile,
          sourceFile,
          "background-refetch-content",
          "Public listing pages must retain ready content and use the fixed background-progress slot."
        )
      );
    }
  }

  if (file.endsWith("PublicShellRouteLayout.tsx")) {
    if (!tags.some((tag) => tag.name === "PublicSiteShell") || !tags.some((tag) => tag.name === "Outlet")) {
      violations.push(
        createViolation(
          file,
          sourceFile,
          sourceFile,
          "single-public-shell-owner",
          "The Public route layout must own one PublicSiteShell around its Outlet."
        )
      );
    }
  }

  return violations;
}

function readRepositoryFile(repositoryRoot, file) {
  const path = join(repositoryRoot, file);

  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function runPublicLayoutStabilityGovernance(repositoryRoot) {
  const governedFiles = [
    "src/public/components/PublicSiteShell.tsx",
    "src/public/components/PublicFooterDirectory.tsx",
    "src/public/components/PublicLoadingState.tsx",
    "src/public/components/PublicShellRouteLayout.tsx",
    ...listingPageFiles
  ];
  const violations = [];

  for (const file of governedFiles) {
    const source = readRepositoryFile(repositoryRoot, file);

    if (source === null) {
      violations.push({
        file,
        line: 1,
        rule: "required-layout-file",
        message: "Required Public layout stability file is missing."
      });
      continue;
    }

    violations.push(...scanPublicLayoutSource(file, source));
  }

  const functionalSpec = "tests/functional/publicShellClsStability.spec.ts";
  const functionalSource = readRepositoryFile(repositoryRoot, functionalSpec);

  if (!functionalSource || !functionalSource.includes("readCumulativeLayoutShift")) {
    violations.push({
      file: functionalSpec,
      line: 1,
      rule: "functional-cls-budget",
      message: "The deterministic browser CLS budget spec must remain present."
    });
  }

  if (!functionalSource?.includes("toBeLessThan(0.1)")) {
    violations.push({
      file: functionalSpec,
      line: 1,
      rule: "functional-cls-budget",
      message: "The deterministic browser CLS budget must remain below 0.1."
    });
  }

  const packageSource = readRepositoryFile(repositoryRoot, "package.json");
  const packageJson = packageSource ? JSON.parse(packageSource) : {};

  if (packageJson.scripts?.["layout:check"] !== "node scripts/check-public-layout-stability.mjs") {
    violations.push({
      file: "package.json",
      line: 1,
      rule: "layout-check-script",
      message: "package scripts must expose the committed layout:check gate."
    });
  }

  if (!String(packageJson.scripts?.quality ?? "").includes("pnpm layout:check")) {
    violations.push({
      file: "package.json",
      line: 1,
      rule: "quality-layout-check",
      message: "The package quality command must run layout:check."
    });
  }

  const workflowFile = ".github/workflows/ci.yml";
  const workflowSource = readRepositoryFile(repositoryRoot, workflowFile);

  if (!workflowSource?.includes("pnpm layout:check")) {
    violations.push({
      file: workflowFile,
      line: 1,
      rule: "ci-layout-check",
      message: "The GitHub quality job must run layout:check."
    });
  }

  return violations.map((violation) => ({
    ...violation,
    file: relative(repositoryRoot, join(repositoryRoot, violation.file)).replaceAll("\\", "/")
  }));
}
