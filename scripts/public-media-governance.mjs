import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SCAN_ROOTS = ["src/public", "src/shared/components", "src/shared/media", "src/components/embeds"];
const APPROVED_IMAGE_OWNERS = new Set([
  "src/shared/components/CarouselImageStage.tsx",
  "src/shared/media/PublicResponsiveImage.tsx"
]);
const APPROVED_IFRAME_OWNERS = new Set(["src/shared/media/PublicDeferredEmbed.tsx"]);
const APPROVED_HIGH_PRIORITY_OWNERS = new Set([
  "src/public/components/PublicHomeCarousel.tsx",
  "src/shared/components/CarouselImageStage.tsx",
  "src/shared/media/PublicResponsiveImage.tsx"
]);
const SMALL_IMAGE_INTENTS = new Set([
  "logo",
  "tiny-thumbnail",
  "content-card",
  "featured-card",
  "portrait",
  "event-attachment"
]);
const MAX_PUBLIC_DRIVE_WIDTH = 1600;

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function listSourceFiles(rootDirectory) {
  if (!fs.existsSync(rootDirectory)) {
    return [];
  }

  const entries = fs.readdirSync(rootDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSourceFiles(absolutePath));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function getJsxAttribute(node, name) {
  return node.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text.toLowerCase() === name.toLowerCase()
  );
}

function getJsxAttributeText(attribute, sourceFile) {
  if (!attribute?.initializer) {
    return "";
  }

  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }

  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    if (ts.isStringLiteral(attribute.initializer.expression)) {
      return attribute.initializer.expression.text;
    }

    return attribute.initializer.expression.getText(sourceFile);
  }

  return attribute.initializer.getText(sourceFile);
}

function getRenderedElementKind(node, sourceFile) {
  const tagName = node.tagName.getText(sourceFile).toLowerCase();

  if (tagName === "img" || tagName === "iframe") {
    return tagName;
  }

  const componentAttribute = getJsxAttribute(node, "component");
  const componentValue = getJsxAttributeText(componentAttribute, sourceFile).toLowerCase();

  return componentValue === "img" || componentValue === "iframe" ? componentValue : "";
}

function unwrapExpression(node) {
  let current = node;

  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }

  return current;
}

function propertyNameText(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }

  return "";
}

export function scanPublicMediaSource(relativePath, sourceText) {
  const normalizedRelativePath = normalizePath(relativePath);
  const sourceFile = ts.createSourceFile(
    normalizedRelativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    normalizedRelativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations = [];

  function report(node, rule, message) {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    violations.push({
      file: normalizedRelativePath,
      line,
      rule,
      message
    });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const importPath = node.moduleSpecifier.text;

      if (
        normalizedRelativePath.startsWith("src/shared/media/") &&
        /(^|\/)(admin|cms-auth)(\/|$)|cmsauth/i.test(importPath)
      ) {
        report(node, "public-media-import-boundary", `Public media code imports restricted module "${importPath}".`);
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const elementKind = getRenderedElementKind(node, sourceFile);
      const srcText = getJsxAttributeText(getJsxAttribute(node, "src"), sourceFile);
      const fetchPriorityText = getJsxAttributeText(
        getJsxAttribute(node, "fetchpriority") || getJsxAttribute(node, "fetchPriority"),
        sourceFile
      );

      if (elementKind === "img" && !APPROVED_IMAGE_OWNERS.has(normalizedRelativePath)) {
        report(
          node,
          "approved-image-owner",
          "Public img rendering must use PublicResponsiveImage or CarouselImageStage."
        );
      }

      if (elementKind === "iframe" && !APPROVED_IFRAME_OWNERS.has(normalizedRelativePath)) {
        report(node, "approved-iframe-owner", "Public iframe rendering must use PublicDeferredEmbed.");
      }

      if (elementKind === "img" && /\bpreviewUrl\b/.test(srcText)) {
        report(node, "no-direct-preview-src", "Public img src must not consume previewUrl directly.");
      }

      if (/\bhigh\b/.test(fetchPriorityText) && !APPROVED_HIGH_PRIORITY_OWNERS.has(normalizedRelativePath)) {
        report(node, "critical-priority-owner", "High image priority is outside an approved critical-media owner.");
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export function parsePublicImagePolicies(sourceText) {
  const sourceFile = ts.createSourceFile(
    "publicImageSources.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const policies = {};

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "PUBLIC_IMAGE_POLICIES") {
        continue;
      }

      const initializer = declaration.initializer ? unwrapExpression(declaration.initializer) : undefined;

      if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        continue;
      }

      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const intent = propertyNameText(property.name);
        const policyValue = unwrapExpression(property.initializer);

        if (!intent || !ts.isObjectLiteralExpression(policyValue)) {
          continue;
        }

        let widths = [];
        let fallbackWidth = Number.NaN;

        for (const policyProperty of policyValue.properties) {
          if (!ts.isPropertyAssignment(policyProperty)) {
            continue;
          }

          const key = propertyNameText(policyProperty.name);
          const value = unwrapExpression(policyProperty.initializer);

          if (key === "widths" && ts.isArrayLiteralExpression(value)) {
            widths = value.elements
              .map((element) => (ts.isNumericLiteral(element) ? Number(element.text) : Number.NaN))
              .filter(Number.isFinite);
          }

          if (key === "fallbackWidth" && ts.isNumericLiteral(value)) {
            fallbackWidth = Number(value.text);
          }
        }

        policies[intent] = { fallbackWidth, widths };
      }
    }
  }

  return policies;
}

export function validatePublicImagePolicies(policies) {
  const violations = [];

  if (Object.keys(policies).length === 0) {
    return ["PUBLIC_IMAGE_POLICIES could not be parsed."];
  }

  for (const [intent, policy] of Object.entries(policies)) {
    const { fallbackWidth, widths } = policy;
    const sortedWidths = [...widths].sort((left, right) => left - right);

    if (widths.length === 0) {
      violations.push(`${intent}: width candidates must not be empty.`);
      continue;
    }

    if (widths.some((width) => !Number.isInteger(width) || width <= 0 || width > MAX_PUBLIC_DRIVE_WIDTH)) {
      violations.push(`${intent}: widths must be positive integers bounded at ${MAX_PUBLIC_DRIVE_WIDTH}.`);
    }

    if (new Set(widths).size !== widths.length) {
      violations.push(`${intent}: width candidates must be unique.`);
    }

    if (widths.some((width, index) => width !== sortedWidths[index])) {
      violations.push(`${intent}: width candidates must be sorted ascending.`);
    }

    if (!widths.includes(fallbackWidth)) {
      violations.push(`${intent}: fallbackWidth must be one of the declared candidates.`);
    }

    if (SMALL_IMAGE_INTENTS.has(intent)) {
      if (!widths.some((width) => width > 0 && width < 640)) {
        violations.push(`${intent}: small-image policy must include a candidate below 640.`);
      }

      if (!(fallbackWidth > 0 && fallbackWidth < MAX_PUBLIC_DRIVE_WIDTH)) {
        violations.push(`${intent}: small-image fallback must be below ${MAX_PUBLIC_DRIVE_WIDTH}.`);
      }
    }
  }

  return violations;
}

export function runPublicMediaGovernance(repoRoot) {
  const violations = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, scanRoot);

    for (const absolutePath of listSourceFiles(absoluteRoot)) {
      const relativePath = normalizePath(path.relative(repoRoot, absolutePath));
      violations.push(...scanPublicMediaSource(relativePath, fs.readFileSync(absolutePath, "utf8")));
    }
  }

  const policyPath = path.join(repoRoot, "src/shared/media/publicImageSources.ts");

  if (!fs.existsSync(policyPath)) {
    violations.push({
      file: "src/shared/media/publicImageSources.ts",
      line: 1,
      rule: "central-policy",
      message: "Central Public image policy is missing."
    });
  } else {
    const policySource = fs.readFileSync(policyPath, "utf8");
    const policyViolations = validatePublicImagePolicies(parsePublicImagePolicies(policySource));

    for (const message of policyViolations) {
      violations.push({
        file: "src/shared/media/publicImageSources.ts",
        line: 1,
        rule: "width-policy",
        message
      });
    }
  }

  const duplicateDriveImplementations = listSourceFiles(path.join(repoRoot, "src"))
    .filter(
      (absolutePath) =>
        normalizePath(path.relative(repoRoot, absolutePath)) !== "src/shared/media/publicImageSources.ts"
    )
    .filter((absolutePath) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(absolutePath))
    .filter((absolutePath) => !normalizePath(absolutePath).includes("/src/test/"))
    .filter((absolutePath) => fs.readFileSync(absolutePath, "utf8").includes("drive.google.com/thumbnail?id="));

  for (const absolutePath of duplicateDriveImplementations) {
    violations.push({
      file: normalizePath(path.relative(repoRoot, absolutePath)),
      line: 1,
      rule: "central-policy",
      message: "Google Drive thumbnail generation must remain centralized."
    });
  }

  return violations;
}
