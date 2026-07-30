import { gzipSync } from "node:zlib";

// Keep these fixed ceilings aligned with the reviewed measurements in
// docs/performance/performance-governance-and-analytics.md.
// Accepted React 19 / Material UI 9 rebaseline: measured 445876 raw / 143145 gzip bytes; ceilings retain about 3% headroom.
export const PUBLIC_PERFORMANCE_BUDGET = Object.freeze({
  javascriptFiles: 14,
  rawBytes: 460_000,
  gzipBytes: 148_000
});

export const FORBIDDEN_SYNCHRONOUS_TELEMETRY_MODULES = Object.freeze([
  "/node_modules/@vercel/analytics/",
  "/node_modules/@vercel/speed-insights/",
  "/src/shared/telemetry/PublicTelemetry.tsx",
  "/src/shared/components/VercelInsights.tsx",
  "/src/shared/components/PublicAnalytics.tsx",
  "/src/shared/utils/publicAnalytics.ts",
  "/src/features/site-view/"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeModuleId(moduleId) {
  return String(moduleId).replaceAll("\\", "/").replace(/^\0/u, "");
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }

  return value;
}

function requireManifestChunk(manifest, key) {
  const chunk = manifest[key];

  if (!isRecord(chunk) || typeof chunk.file !== "string" || !chunk.file) {
    throw new Error(`Vite manifest entry "${key}" is missing a valid output file.`);
  }

  if (chunk.imports !== undefined && !Array.isArray(chunk.imports)) {
    throw new Error(`Vite manifest entry "${key}" has an invalid imports field.`);
  }

  return chunk;
}

export function parseViteManifestSource(source) {
  const text = typeof source === "string" ? source : Buffer.from(source).toString("utf8");
  const manifest = JSON.parse(text);

  if (!isRecord(manifest)) {
    throw new Error("Vite manifest must be a JSON object.");
  }

  return manifest;
}

export function findIndexHtmlEntry(manifest) {
  if (!isRecord(manifest)) {
    throw new Error("Vite manifest must be an object.");
  }

  const matches = Object.entries(manifest).filter(
    ([key, value]) => isRecord(value) && value.isEntry === true && (key === "index.html" || value.src === "index.html")
  );

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one index.html Vite entry, found ${matches.length}.`);
  }

  const [key] = matches[0];
  return {
    key,
    chunk: requireManifestChunk(manifest, key)
  };
}

export function collectStaticManifestEntries(manifest, entryKey) {
  const visited = new Set();

  function visit(key) {
    if (visited.has(key)) {
      return;
    }

    const chunk = requireManifestChunk(manifest, key);
    visited.add(key);

    for (const importedKey of chunk.imports ?? []) {
      if (typeof importedKey !== "string" || !importedKey) {
        throw new Error(`Vite manifest entry "${key}" contains an invalid static import.`);
      }

      visit(importedKey);
    }
  }

  visit(entryKey);
  return [...visited];
}

function isJavaScriptFile(fileName) {
  return /\.(?:c|m)?js$/u.test(fileName);
}

export function analyzePublicEntryBuild({
  manifest,
  outputChunks,
  forbiddenModules = FORBIDDEN_SYNCHRONOUS_TELEMETRY_MODULES
}) {
  const { key: entryKey } = findIndexHtmlEntry(manifest);
  const manifestKeys = collectStaticManifestEntries(manifest, entryKey);
  const javascriptFiles = [
    ...new Set(
      manifestKeys
        .map((key) => requireManifestChunk(manifest, key).file)
        .filter((fileName) => isJavaScriptFile(fileName))
    )
  ];

  if (javascriptFiles.length === 0) {
    throw new Error("The static index.html graph does not contain a JavaScript chunk.");
  }

  const chunksByFile = new Map();

  for (const chunk of outputChunks) {
    if (!isRecord(chunk) || chunk.type !== "chunk" || typeof chunk.fileName !== "string") {
      continue;
    }

    if (chunksByFile.has(chunk.fileName)) {
      throw new Error(`Vite emitted duplicate JavaScript chunk "${chunk.fileName}".`);
    }

    chunksByFile.set(chunk.fileName, chunk);
  }

  let rawBytes = 0;
  let gzipBytes = 0;
  const moduleIds = new Set();

  for (const fileName of javascriptFiles) {
    const chunk = chunksByFile.get(fileName);

    if (!chunk || typeof chunk.code !== "string") {
      throw new Error(`Vite output is missing the static JavaScript chunk "${fileName}".`);
    }

    if (!isRecord(chunk.modules) || Object.keys(chunk.modules).length === 0) {
      throw new Error(`Vite output chunk "${fileName}" is missing module associations.`);
    }

    const bytes = Buffer.from(chunk.code, "utf8");
    rawBytes += bytes.length;
    gzipBytes += gzipSync(bytes, { level: 9 }).length;

    for (const moduleId of Object.keys(chunk.modules)) {
      moduleIds.add(normalizeModuleId(moduleId));
    }
  }

  const normalizedForbiddenModules = forbiddenModules.map(normalizeModuleId);
  const forbiddenAssociations = normalizedForbiddenModules.filter((forbiddenModule) =>
    [...moduleIds].some((moduleId) => moduleId.includes(forbiddenModule))
  );

  return {
    entryKey,
    javascriptFiles,
    javascriptFileCount: javascriptFiles.length,
    rawBytes,
    gzipBytes,
    moduleIds: [...moduleIds].sort(),
    forbiddenAssociations
  };
}

export function evaluatePublicPerformanceBudget(metrics, budget = PUBLIC_PERFORMANCE_BUDGET) {
  const checks = [
    {
      label: "Synchronous JavaScript files",
      actual: requireNonNegativeInteger(metrics.javascriptFileCount, "JavaScript file count"),
      limit: requireNonNegativeInteger(budget.javascriptFiles, "JavaScript file limit")
    },
    {
      label: "Synchronous JavaScript raw bytes",
      actual: requireNonNegativeInteger(metrics.rawBytes, "Raw byte count"),
      limit: requireNonNegativeInteger(budget.rawBytes, "Raw byte limit")
    },
    {
      label: "Synchronous JavaScript gzip bytes",
      actual: requireNonNegativeInteger(metrics.gzipBytes, "Gzip byte count"),
      limit: requireNonNegativeInteger(budget.gzipBytes, "Gzip byte limit")
    }
  ].map((check) => ({
    ...check,
    difference: check.actual - check.limit,
    passed: check.actual <= check.limit
  }));
  const forbiddenAssociations = Array.isArray(metrics.forbiddenAssociations) ? [...metrics.forbiddenAssociations] : [];

  return {
    checks,
    forbiddenAssociations,
    passed: checks.every((check) => check.passed) && forbiddenAssociations.length === 0
  };
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

export function formatPublicPerformanceBudgetReport(result) {
  const lines = ["Public synchronous performance budget:"];

  for (const check of result.checks) {
    lines.push(
      `- ${check.label}: actual ${check.actual}; limit ${check.limit}; difference ${formatSigned(check.difference)}; ${
        check.passed ? "PASS" : "FAIL"
      }`
    );
  }

  if (result.forbiddenAssociations.length === 0) {
    lines.push("- Forbidden synchronous telemetry associations: none; PASS");
  } else {
    lines.push("- Forbidden synchronous telemetry associations: FAIL");
    for (const association of result.forbiddenAssociations) {
      lines.push(`  - ${association}`);
    }
  }

  lines.push(`Performance budget result: ${result.passed ? "PASS" : "FAIL"}`);
  return lines.join("\n");
}
