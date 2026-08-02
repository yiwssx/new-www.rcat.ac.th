import fs from "node:fs";

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

patch(
  "cloudflare/public-api/src/contracts/publicHome.ts",
  'import type { PublicContentItemContract } from "./publicContent";',
  'import type { PublicContentSummaryContract } from "./publicContent";'
);

for (const field of [
  "latestNews",
  "latestAnnouncements",
  "procurementItems",
  "jobOpportunityItems",
  "achievementItems",
  "programItems",
  "featuredContent",
  "programs"
]) {
  patch(
    "cloudflare/public-api/src/contracts/publicHome.ts",
    `  ${field}: PublicContentItemContract[];`,
    `  ${field}: PublicContentSummaryContract[];`
  );
}

patch(
  "cloudflare/public-api/src/contracts/publicSearch.ts",
  'import type { PublicContentItemContract } from "./publicContent";',
  'import type { PublicContentSummaryContract } from "./publicContent";'
);
patch(
  "cloudflare/public-api/src/contracts/publicSearch.ts",
  "  items: PublicContentItemContract[];",
  "  items: PublicContentSummaryContract[];"
);

patch(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  'import type { PublicContentItemContract } from "../contracts/publicContent";',
  'import type { PublicContentSummaryContract } from "../contracts/publicContent";'
);
patch(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  "function compareContentPublishAtDesc(left: PublicContentItemContract, right: PublicContentItemContract) {",
  "function compareContentPublishAtDesc(left: PublicContentSummaryContract, right: PublicContentSummaryContract) {"
);
patch(
  "cloudflare/public-api/src/adapters/publicHomeAdapter.ts",
  "function isAchievementItem(item: PublicContentItemContract) {",
  "function isAchievementItem(item: PublicContentSummaryContract) {"
);

patch(
  "cloudflare/public-api/test/publicReadCoreRoutes.test.ts",
  '    expect(payload.media).toEqual([\n      expect.objectContaining({ id: "sample-media-001" }),\n      expect.objectContaining({ id: "sample-media-002" })\n    ]);\n    expectGeneratedAt(payload);',
  '    expect(payload.media).toEqual([\n      expect.objectContaining({ id: "sample-media-001" }),\n      expect.objectContaining({ id: "sample-media-002" })\n    ]);\n    const homeNews = (payload.latestNews as Array<Record<string, unknown>>)[0];\n    expect(homeNews).not.toHaveProperty("body");\n    expect(homeNews).not.toHaveProperty("content");\n    expectGeneratedAt(payload);'
);
