import fs from "node:fs";

const file = "src/features/public-read/publicReadProviderParity.test.ts";
let source = fs.readFileSync(file, "utf8");

const detailFrom = `      "/api/public/content/sample-news": {\n        item: publicItem,\n        generatedAt\n      },`;
const detailTo = `      "/api/public/content/sample-news": {\n        item: publicItem,\n        media: [],\n        generatedAt\n      },`;

if (!source.includes(detailFrom)) {
  throw new Error("Missing legacy content-detail parity fixture");
}

source = source.replace(detailFrom, detailTo);
fs.writeFileSync(file, source);
