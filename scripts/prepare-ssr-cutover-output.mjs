import { access, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");
const csrPath = path.join(distDir, "csr.html");
const clientEntryPath = path.join(distDir, "assets", "rcat-client.js");
const clientStylesheetPath = path.join(distDir, "assets", "rcat-client.css");

async function assertFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} is missing from the production client build: ${path.relative(rootDir, filePath)}`);
  }
}

await Promise.all([
  assertFile(indexPath, "Vite index document"),
  assertFile(clientEntryPath, "SSR client entry"),
  assertFile(clientStylesheetPath, "SSR client stylesheet")
]);

const indexHtml = await readFile(indexPath, "utf8");
if (!indexHtml.includes("/assets/rcat-client.js") || !indexHtml.includes("/assets/rcat-client.css")) {
  throw new Error("Vite index document does not reference the deterministic SSR client assets");
}

await rm(csrPath, { force: true });
await rename(indexPath, csrPath);

console.log("Prepared SSR cutover output: dist/csr.html retained for Admin/Auth CSR and dist/index.html removed.");
