import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST_DIRECTORY = path.resolve("dist");
const MANIFEST_PATH = path.join(DIST_DIRECTORY, ".vite", "manifest.json");

function normalizePath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

function loadManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function findManifestEntry(manifest, sourcePath) {
  const normalizedSourcePath = normalizePath(sourcePath);
  return Object.entries(manifest).find(([key, chunk]) => {
    const source = normalizePath(chunk?.src);
    return normalizePath(key).endsWith(normalizedSourcePath) || source.endsWith(normalizedSourcePath);
  });
}

function collectStaticGraph(manifest, entryKey) {
  const visited = new Set();

  function visit(key) {
    if (visited.has(key)) {
      return;
    }

    const chunk = manifest[key];
    if (!chunk?.file) {
      throw new Error(`Manifest entry ${key} is missing an emitted file.`);
    }

    visited.add(key);
    for (const importedKey of chunk.imports ?? []) {
      visit(importedKey);
    }
  }

  visit(entryKey);
  return [...visited];
}

function measureFiles(manifest, entryKeys) {
  const files = [...new Set(entryKeys.map((key) => manifest[key]?.file).filter(Boolean))];
  let rawBytes = 0;
  let gzipBytes = 0;

  for (const file of files) {
    const absolutePath = path.join(DIST_DIRECTORY, file);
    const source = readFileSync(absolutePath);
    rawBytes += statSync(absolutePath).size;
    gzipBytes += gzipSync(source, { level: 9 }).length;
  }

  return { files, rawBytes, gzipBytes };
}

function reportEntry(manifest, label, sourcePath, { optional = false } = {}) {
  const match = findManifestEntry(manifest, sourcePath);
  if (!match) {
    if (optional) {
      console.log(`- ${label}: not emitted as an independent manifest entry`);
      return null;
    }
    throw new Error(`Unable to find ${sourcePath} in ${MANIFEST_PATH}.`);
  }

  const [entryKey, chunk] = match;
  const ownMetrics = measureFiles(manifest, [entryKey]);
  const staticGraphMetrics = measureFiles(manifest, collectStaticGraph(manifest, entryKey));

  console.log(`- ${label}: ${chunk.file}`);
  console.log(`  own raw ${formatBytes(ownMetrics.rawBytes)}; own gzip ${formatBytes(ownMetrics.gzipBytes)}`);
  console.log(
    `  static graph raw ${formatBytes(staticGraphMetrics.rawBytes)}; static graph gzip ${formatBytes(staticGraphMetrics.gzipBytes)}; files ${staticGraphMetrics.files.length}`
  );

  return { entryKey, ownMetrics, staticGraphMetrics };
}

const manifest = loadManifest();

console.log("Admin editor bundle evidence:");
reportEntry(manifest, "ContentEditorDialog", "src/admin/components/ContentEditorDialog.tsx");
reportEntry(manifest, "RichTextEditor", "src/admin/components/RichTextEditor.tsx", { optional: true });
reportEntry(manifest, "RichTextMediaPickerDialog", "src/admin/components/RichTextMediaPickerDialog.tsx", { optional: true });
