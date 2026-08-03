import fs from "node:fs";

const parityFile = "src/features/public-read/publicReadProviderParity.test.ts";
let paritySource = fs.readFileSync(parityFile, "utf8");

const detailFrom = `      "/api/public/content/sample-news": {\n        item: publicItem,\n        generatedAt\n      },`;
const detailTo = `      "/api/public/content/sample-news": {\n        item: publicItem,\n        media: [],\n        generatedAt\n      },`;

if (!paritySource.includes(detailFrom)) {
  throw new Error("Missing legacy content-detail parity fixture");
}

paritySource = paritySource.replace(detailFrom, detailTo);
fs.writeFileSync(parityFile, paritySource);

const apiFile = "src/features/public-read/cloudflareApi.ts";
let apiSource = fs.readFileSync(apiFile, "utf8");
const displaySettingsFrom = "persistDisplaySettings(payload.displaySettings as DisplaySettings);";
const displaySettingsTo = "persistDisplaySettings(payload.displaySettings as unknown as DisplaySettings);";

if (!apiSource.includes(displaySettingsFrom)) {
  throw new Error("Missing validated public-shell display settings cast");
}

apiSource = apiSource.replace(displaySettingsFrom, displaySettingsTo);
fs.writeFileSync(apiFile, apiSource);
