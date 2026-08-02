import fs from "node:fs";
import path from "node:path";

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

patch(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  'import type {\n  PublicContentDetailSnapshotContract,\n  PublicContentItemContract,\n  PublicContentListSnapshotContract\n} from "../contracts/publicContent";',
  'import type {\n  PublicContentDetailSnapshotContract,\n  PublicContentItemContract,\n  PublicContentListSnapshotContract,\n  PublicContentSummaryContract\n} from "../contracts/publicContent";'
);

patch(
  "cloudflare/public-api/src/adapters/publicContentAdapter.ts",
  'export function mapContentSummaryRowToPublicContentItem(row: PublicContentSummaryReadRow) {\n  return mapContentRowToPublicContentItem({ ...(row as PublicContentReadRow), body_snapshot: "" });\n}',
  'export function mapContentSummaryRowToPublicContentItem(\n  row: PublicContentSummaryReadRow\n): PublicContentSummaryContract {\n  const { body: _body, content: _content, ...summary } = mapContentRowToPublicContentItem({\n    ...(row as PublicContentReadRow),\n    body_snapshot: ""\n  });\n  return summary;\n}'
);

function walk(directory) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", ".dependency-migration"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) results.push(full);
  }
  return results;
}

const needles = [
  "serves live website/public metadata from D1 and supports nested menu edits",
  "serves public content lists and content detail directly from D1",
  "Admissions body v2",
  "page-admissions"
];

for (const root of ["src", "cloudflare"]) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, "utf8");
    if (!needles.some((needle) => source.includes(needle))) continue;
    console.log(`SSR_READINESS_PARITY_FILE=${file}`);
    const lines = source.split("\n");
    lines.forEach((line, index) => {
      if (needles.some((needle) => line.includes(needle))) {
        const start = Math.max(0, index - 12);
        const end = Math.min(lines.length, index + 24);
        console.log(`--- ${file}:${start + 1}-${end} ---`);
        console.log(lines.slice(start, end).join("\n"));
      }
    });
  }
}
