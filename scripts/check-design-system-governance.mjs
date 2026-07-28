import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repositoryRoot = process.cwd();
const migratedRoots = [
  "src/admin",
  "src/public",
  "src/shared/components",
  "src/components",
  "src/features/public-documents"
];
const sourceExtensions = new Set([".ts", ".tsx"]);
const legitimateVisualExceptions = new Set([
  // Media geometry and overlays have their own existing stability/performance governance.
  "src/components/embeds/FacebookPostEmbed.tsx",
  "src/public/components/PublicHomeCarousel.tsx",
  "src/public/components/PublicIntroGate.tsx",
  "src/shared/components/CarouselImageStage.tsx",
  // Messenger blue is a documented third-party brand color.
  "src/public/components/FloatingMessengerButton.tsx",
  // These files are the canonical declarations for token values and focus policy.
  "src/design-system/tokens.ts",
  "src/design-system/componentStyles.ts"
]);
const authAdminFoundationFiles = new Set([
  "src/admin/layout/CmsShell.tsx",
  "src/admin/pages/ActivateAccountPage.tsx",
  "src/admin/pages/LoginPage.tsx",
  "src/admin/pages/ResetPasswordPage.tsx",
  "src/design-system/components/AuthPageLayout.tsx"
]);

async function collectSourceFiles(relativeDirectory) {
  const entries = await readdir(path.join(repositoryRoot, relativeDirectory), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(relativePath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function moduleImports(sourceFile) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter((declaration) => ts.isStringLiteral(declaration.moduleSpecifier))
    .map((declaration) => declaration.moduleSpecifier.text);
}

function hasHardCodedColor(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i.test(node.text);
  }

  return false;
}

export function inspectDesignSystemSource(relativePath, source) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    normalizedPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations = [];
  const imports = moduleImports(sourceFile);

  if (imports.includes("@mui/icons-material")) {
    violations.push("broad @mui/icons-material barrel import");
  }

  if (normalizedPath.startsWith("src/design-system/")) {
    const implementationImport = imports.find((specifier) => /(?:^|\/)(?:admin|public)(?:\/|$)/.test(specifier));
    if (implementationImport) {
      violations.push(`design-system primitive imports implementation module: ${implementationImport}`);
    }
  }

  if (normalizedPath.startsWith("src/public/")) {
    const adminImport = imports.find((specifier) => /(?:^|\/)admin(?:\/|$)|cmsAuth/i.test(specifier));
    if (adminImport) {
      violations.push(`Public design module imports Admin/Auth implementation: ${adminImport}`);
    }
  }

  if (authAdminFoundationFiles.has(normalizedPath)) {
    const publicImport = imports.find((specifier) =>
      /PublicSiteShell|PublicTelemetry|publicTelemetry/i.test(specifier)
    );
    if (publicImport) {
      violations.push(`Auth/Admin foundation imports Public shell or telemetry: ${publicImport}`);
    }
  }

  if (!legitimateVisualExceptions.has(normalizedPath)) {
    let hardCodedColorCount = 0;
    let localFocusCount = 0;

    function visit(node) {
      if (hasHardCodedColor(node)) {
        hardCodedColorCount += 1;
      }

      if (
        (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) &&
        /focus-visible|Mui-focusVisible/.test(node.name?.getText(sourceFile) ?? "")
      ) {
        localFocusCount += 1;
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (hardCodedColorCount > 0) {
      violations.push(`${hardCodedColorCount} hard-coded color literal(s) outside the documented allowlist`);
    }
    if (localFocusCount > 0) {
      violations.push(`${localFocusCount} local focus-visible implementation(s)`);
    }
  }

  if (/!important\b/.test(source) && !legitimateVisualExceptions.has(normalizedPath)) {
    violations.push("unauthorized !important usage");
  }

  return violations;
}

function extractCssCustomProperties(source) {
  const properties = new Map();
  const declaration = /(--[\w-]+)\s*:\s*([^;{}]+);/g;

  for (const match of source.matchAll(declaration)) {
    properties.set(match[1], match[2].trim());
  }

  return properties;
}

async function fileExists(relativePath) {
  try {
    await access(path.join(repositoryRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

export async function runDesignSystemGovernance() {
  const violations = [];
  const [tokensSource, themeSource, stylesSource, projectSettingsSource, packageSource, workflowSource] =
    await Promise.all([
      readFile(path.join(repositoryRoot, "src/design-system/tokens.ts"), "utf8"),
      readFile(path.join(repositoryRoot, "src/theme.ts"), "utf8"),
      readFile(path.join(repositoryRoot, "src/styles.css"), "utf8"),
      readFile(path.join(repositoryRoot, "src/config/project-settings.json"), "utf8"),
      readFile(path.join(repositoryRoot, "package.json"), "utf8"),
      readFile(path.join(repositoryRoot, ".github/workflows/ci.yml"), "utf8")
    ]);

  if (!/export const designTokens/.test(tokensSource) || !/export const designTokenCssVariables/.test(tokensSource)) {
    violations.push("src/design-system/tokens.ts is not the canonical semantic token source");
  }
  if (!/from ["']\.\/design-system\/tokens["']/.test(themeSource)) {
    violations.push("src/theme.ts does not consume the canonical token source");
  }
  if (/"theme"\s*:/.test(projectSettingsSource)) {
    violations.push("project-settings.json contains a competing theme definition");
  }
  if (/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i.test(stylesSource)) {
    violations.push("src/styles.css contains color literals instead of canonical CSS variables");
  }

  const cssProperties = extractCssCustomProperties(stylesSource);
  const requiredAliases = new Map([
    ["--color-rcat-green", "var(--rcat-color-brand-primary)"],
    ["--color-rcat-yellow", "var(--rcat-color-brand-accent)"],
    ["--rcat-primary", "var(--rcat-color-brand-primary)"],
    ["--rcat-secondary", "var(--rcat-color-brand-accent)"],
    ["--rcat-accent", "var(--rcat-color-brand-accent)"],
    ["--rcat-surface", "var(--rcat-color-surface)"],
    ["--rcat-border", "var(--rcat-color-border-subtle)"],
    ["--rcat-shadow-sm", "var(--rcat-elevation-low)"]
  ]);

  for (const [property, expectedValue] of requiredAliases) {
    if (cssProperties.get(property) !== expectedValue) {
      violations.push(`${property} must map to ${expectedValue}`);
    }
  }

  const migratedFiles = (await Promise.all(migratedRoots.map(collectSourceFiles))).flat();
  const designSystemFiles = await collectSourceFiles("src/design-system");
  for (const relativePath of [...new Set([...migratedFiles, ...designSystemFiles])].sort()) {
    if (relativePath.includes(".test.") || relativePath.includes(".spec.")) {
      continue;
    }
    const source = await readFile(path.join(repositoryRoot, relativePath), "utf8");
    for (const violation of inspectDesignSystemSource(relativePath, source)) {
      violations.push(`${relativePath}: ${violation}`);
    }
  }

  const requiredFiles = [
    "src/test/designSystemTokens.test.ts",
    "src/test/designSystemComponents.test.tsx",
    "src/test/designSystemGovernance.test.mjs",
    "tests/functional/designSystemUiUx.spec.ts"
  ];
  for (const relativePath of requiredFiles) {
    if (!(await fileExists(relativePath))) {
      violations.push(`required regression coverage is missing: ${relativePath}`);
    }
  }

  const packageJson = JSON.parse(packageSource);
  const qualityScript = packageJson.scripts?.quality ?? "";
  if (packageJson.scripts?.["design:check"] !== "node scripts/check-design-system-governance.mjs") {
    violations.push("package design:check script is missing or points to the wrong command");
  }

  const orderedChecks = ["pnpm perf:check", "pnpm media:check", "pnpm layout:check", "pnpm design:check"];
  let previousIndex = -1;
  for (const check of orderedChecks) {
    const currentIndex = qualityScript.indexOf(check);
    if (currentIndex <= previousIndex) {
      violations.push(`quality must include ${orderedChecks.join(" -> ")} in order`);
      break;
    }
    previousIndex = currentIndex;
  }
  if (!/run:\s*pnpm design:check/.test(workflowSource)) {
    violations.push("GitHub Actions quality job does not run pnpm design:check");
  }

  return violations;
}

async function main() {
  const violations = await runDesignSystemGovernance();
  if (violations.length > 0) {
    console.error("Design-system governance failed:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Design-system governance passed.");
  console.log("Canonical tokens, CSS aliases, focus policy, import boundaries, tests, quality, and CI are consistent.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
