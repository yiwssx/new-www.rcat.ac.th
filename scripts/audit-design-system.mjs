import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repositoryRoot = process.cwd();
const componentRoots = [
  "src/admin",
  "src/public",
  "src/shared/components",
  "src/components",
  "src/features/public-documents"
];
const styleFiles = ["src/styles.css"];
const sourceExtensions = new Set([".ts", ".tsx"]);

const auditAllowlist = {
  // Media focal geometry and third-party embed sizing are intentionally local.
  files: [
    "src/components/embeds/FacebookPostEmbed.tsx",
    "src/public/components/PublicHomeCarousel.tsx",
    "src/public/components/PublicIntroGate.tsx",
    "src/shared/components/CarouselImageStage.tsx"
  ]
};
const themeSource = await readFile(path.join(repositoryRoot, "src/theme.ts"), "utf8");
const hasGlobalCompactControlPolicy =
  /MuiIconButton[\s\S]*sizeSmall[\s\S]*control\.compactHeight/.test(themeSource) &&
  /MuiButton[\s\S]*sizeSmall[\s\S]*control\.compactHeight/.test(themeSource);

async function collectFiles(relativeDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relativePath)));
      continue;
    }

    if (
      sourceExtensions.has(path.extname(entry.name)) &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      files.push(relativePath);
    }
  }

  return files;
}

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function getJsxTagName(node) {
  return node.tagName.getText();
}

function getJsxAttribute(node, name) {
  return node.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === name
  );
}

function getAttributeText(attribute, sourceFile) {
  if (!attribute?.initializer) {
    return "";
  }

  return attribute.initializer.getText(sourceFile);
}

function getObjectPropertyName(property) {
  if (
    ts.isPropertyAssignment(property) ||
    ts.isShorthandPropertyAssignment(property) ||
    ts.isMethodDeclaration(property)
  ) {
    return property.name?.getText().replaceAll(/["']/g, "") ?? "";
  }

  return "";
}

function getNumericStyleValue(text, propertyName) {
  const expression = new RegExp(`\\b${propertyName}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\b`);
  const match = text.match(expression);
  return match ? Number(match[1]) : null;
}

function hasResponsiveSize(text, propertyName) {
  return new RegExp(`\\b${propertyName}\\s*:\\s*\\{`).test(text);
}

function hasInteractiveDescendants(node) {
  let buttons = 0;

  function visit(child) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const opening = ts.isJsxElement(child) ? child.openingElement : child;
      if (["Button", "IconButton"].includes(getJsxTagName(opening))) {
        buttons += 1;
      }
    }
    ts.forEachChild(child, visit);
  }

  ts.forEachChild(node, visit);
  return buttons >= 2;
}

function auditSourceFile(relativePath, source) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const metrics = {
    componentHardCodedColors: countMatches(source, /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi),
    hardCodedShadows: countMatches(source, /\bboxShadow\s*:\s*["'`][^"'`]+["'`]/g),
    hardCodedRadii: countMatches(source, /\bborderRadius\s*:\s*(?:\d+(?:\.\d+)?|["'`][^"'`]+["'`])/g),
    duplicateFocusImplementations: countMatches(source, /["']?&:focus-visible["']?\s*:|focus-visible:/g),
    repeatedSurfaceStyleBlocks: 0,
    repeatedPageSectionHeaders: 0,
    repeatedActionRows: 0,
    directButtonHeights: 0,
    directInputHeights: 0,
    controlsBelowPolicySize: 0,
    broadIconImports: 0,
    mixedMuiRcatConcerns: 0,
    repeatedFeedbackPresentations: 0
  };

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text === "@mui/icons-material") {
        metrics.broadIconImports += 1;
      }
    }

    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Set(node.properties.map(getObjectPropertyName));
      const surfaceConcerns = [
        "background",
        "backgroundColor",
        "bgcolor",
        "border",
        "borderColor",
        "borderRadius",
        "boxShadow"
      ].filter((property) => properties.has(property));
      if (surfaceConcerns.length >= 3) {
        metrics.repeatedSurfaceStyleBlocks += 1;
      }
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = getJsxTagName(opening);
      const sxText = getAttributeText(getJsxAttribute(opening, "sx"), sourceFile);
      const classText = getAttributeText(getJsxAttribute(opening, "className"), sourceFile);
      const sizeText = getAttributeText(getJsxAttribute(opening, "size"), sourceFile);

      if (tagName === "Typography") {
        const variantText = getAttributeText(getJsxAttribute(opening, "variant"), sourceFile);
        if (/h[12]/.test(variantText)) {
          metrics.repeatedPageSectionHeaders += 1;
        }
      }

      if (
        (tagName === "DialogActions" ||
          (tagName === "Stack" && /justifyContent.*(?:flex-end|space-between)/s.test(opening.getText(sourceFile)))) &&
        hasInteractiveDescendants(node)
      ) {
        metrics.repeatedActionRows += 1;
      }

      if (["Button", "IconButton"].includes(tagName)) {
        const hasHeight = /\b(?:height|minHeight)\s*:/.test(sxText);
        if (hasHeight) {
          metrics.directButtonHeights += 1;
        }

        const height = getNumericStyleValue(sxText, "height") ?? getNumericStyleValue(sxText, "minHeight");
        if (
          height !== null &&
          height < 40 &&
          !hasResponsiveSize(sxText, "height") &&
          !hasResponsiveSize(sxText, "minHeight")
        ) {
          metrics.controlsBelowPolicySize += 1;
        }

        if (tagName === "IconButton" && /small/.test(sizeText) && height === null && !hasGlobalCompactControlPolicy) {
          metrics.controlsBelowPolicySize += 1;
        }
      }

      if (["TextField", "OutlinedInput", "Select", "InputBase"].includes(tagName)) {
        if (/\b(?:height|minHeight)\s*:/.test(sxText)) {
          metrics.directInputHeights += 1;
        }
      }

      if (
        /rcat-(?:card|surface|admin-card)/.test(classText) &&
        /\b(?:background|backgroundColor|bgcolor|border|borderColor|borderRadius|boxShadow)\s*:/.test(sxText)
      ) {
        metrics.mixedMuiRcatConcerns += 1;
      }

      if (["Alert", "EmptyState", "PublicErrorState", "PublicLoadingState"].includes(tagName)) {
        metrics.repeatedFeedbackPresentations += 1;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return metrics;
}

function sumMetrics(results) {
  return results.reduce((totals, result) => {
    for (const [key, value] of Object.entries(result.metrics)) {
      totals[key] = (totals[key] ?? 0) + value;
    }
    return totals;
  }, {});
}

const sourceFiles = (await Promise.all(componentRoots.map(collectFiles))).flat().sort();
const auditedFiles = [];

for (const relativePath of sourceFiles) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (auditAllowlist.files.includes(normalizedPath)) {
    continue;
  }

  const source = await readFile(path.join(repositoryRoot, normalizedPath), "utf8");
  auditedFiles.push({
    path: normalizedPath,
    metrics: auditSourceFile(normalizedPath, source)
  });
}

let importantUsages = 0;
for (const relativePath of [...sourceFiles, ...styleFiles]) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const source = await readFile(path.join(repositoryRoot, normalizedPath), "utf8");
  importantUsages += countMatches(source, /!important\b/g);
}

const metrics = {
  ...sumMetrics(auditedFiles),
  importantUsages
};

const result = {
  schemaVersion: 1,
  scope: {
    componentRoots,
    allowlistedFiles: auditAllowlist.files,
    auditedFileCount: auditedFiles.length
  },
  metrics
};

if (process.argv.includes("--details")) {
  result.files = auditedFiles.filter(({ metrics: fileMetrics }) =>
    Object.values(fileMetrics).some((value) => value > 0)
  );
}

console.log(JSON.stringify(result, null, 2));
