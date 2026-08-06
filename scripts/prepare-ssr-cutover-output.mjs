import { access, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");
const csrPath = path.join(distDir, "csr.html");
const manifestPath = path.join(distDir, ".vite", "manifest.json");

async function assertFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} is missing from the production client build: ${path.relative(rootDir, filePath)}`);
  }
}

function toPublicAssetPath(file) {
  return `/${String(file || "").replace(/^\/+/, "")}`;
}

await Promise.all([
  assertFile(indexPath, "Vite index document"),
  assertFile(manifestPath, "Vite client manifest")
]);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entry = manifest["index.html"] ?? Object.values(manifest).find((chunk) => chunk?.isEntry);
if (!entry?.file) {
  throw new Error("Vite client manifest does not contain the application entry chunk");
}

const stylesheetFiles = Array.isArray(entry.css) ? entry.css : [];
if (stylesheetFiles.length === 0) {
  throw new Error("Vite client manifest does not contain the application stylesheet");
}

const clientEntryPath = path.join(distDir, entry.file);
const clientStylesheetPaths = stylesheetFiles.map((file) => path.join(distDir, file));
await Promise.all([
  assertFile(clientEntryPath, "Hashed SSR client entry"),
  ...clientStylesheetPaths.map((filePath) => assertFile(filePath, "Hashed SSR client stylesheet"))
]);

const publicEntryPath = toPublicAssetPath(entry.file);
const publicStylesheetPaths = stylesheetFiles.map(toPublicAssetPath);
const indexHtml = await readFile(indexPath, "utf8");
if (!indexHtml.includes(publicEntryPath) || publicStylesheetPaths.some((assetPath) => !indexHtml.includes(assetPath))) {
  throw new Error("Vite index document does not reference the manifest-selected hashed client assets");
}

if (publicEntryPath === "/assets/rcat-client.js" || publicStylesheetPaths.includes("/assets/rcat-client.css")) {
  throw new Error("Production client assets must use content-hashed filenames");
}

await rm(csrPath, { force: true });
await rename(indexPath, csrPath);

console.log(
  `Prepared SSR cutover output with hashed client assets: ${publicEntryPath} and ${publicStylesheetPaths.join(", ")}.`
);
