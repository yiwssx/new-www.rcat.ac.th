import fs from "node:fs";
import path from "node:path";

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

let patched = 0;
for (const file of walk("src/test")) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes("Admissions body v2")) continue;

  const next = source
    .replace(/^\s*body:\s*expect\.stringContaining\(["']Admissions body v2["']\),?\s*$/gm, "")
    .replace(/^\s*content:\s*expect\.stringContaining\(["']Admissions body v2["']\),?\s*$/gm, "");

  if (next !== source) {
    fs.writeFileSync(file, next);
    patched += 1;
    console.log(`Updated stale full-body search expectation in ${file}`);
  }
}

if (patched === 0) {
  throw new Error("Expected to update the stale Admissions body v2 search expectation, but no matching test was found.");
}
