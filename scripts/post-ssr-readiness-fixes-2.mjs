import fs from "node:fs";

function patch(file, from, to) {
  let source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`Missing post-fix source in ${file}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

patch(
  "cloudflare/public-api/src/adapters/publicSearchAdapter.ts",
  'import { mapContentRowToPublicContentItem } from "./publicContentAdapter";\nimport type { PublicSearchSnapshotContract } from "../contracts/publicSearch";\nimport type { PublicContentReadRow } from "../db/contentRepository";',
  'import { mapContentSummaryRowToPublicContentItem } from "./publicContentAdapter";\nimport type { PublicSearchSnapshotContract } from "../contracts/publicSearch";\nimport type { PublicContentSummaryReadRow } from "../db/contentRepository";'
);

patch(
  "cloudflare/public-api/src/adapters/publicSearchAdapter.ts",
  '  rows: PublicContentReadRow[],',
  '  rows: PublicContentSummaryReadRow[],'
);

patch(
  "cloudflare/public-api/src/adapters/publicSearchAdapter.ts",
  '    items: rows.map(mapContentRowToPublicContentItem),',
  '    items: rows.map(mapContentSummaryRowToPublicContentItem),'
);

patch(
  "src/features/public-shell/index.ts",
  'import { getPublicShellSnapshotFromCloudflare, type PublicReadRequestOptions } from "../public-read/cloudflareApi";\nexport type { PublicShellSnapshot } from "../../types";\nexport function getPublicShellSnapshot(options: PublicReadRequestOptions = {}) {\n  return getPublicShellSnapshotFromCloudflare(options);\n}',
  'import {\n  getPublicHomeSnapshotFromCloudflare,\n  getPublicShellSnapshotFromCloudflare,\n  isCloudflarePublicApiNotFoundError,\n  type PublicReadRequestOptions\n} from "../public-read/cloudflareApi";\nimport type { PublicShellSnapshot } from "../../types";\n\nexport type { PublicShellSnapshot } from "../../types";\n\nexport async function getPublicShellSnapshot(options: PublicReadRequestOptions = {}): Promise<PublicShellSnapshot> {\n  try {\n    return await getPublicShellSnapshotFromCloudflare(options);\n  } catch (error) {\n    if (!isCloudflarePublicApiNotFoundError(error)) throw error;\n    const home = await getPublicHomeSnapshotFromCloudflare(options);\n    return {\n      siteSettings: home.siteSettings,\n      homepageSettings: home.homepageSettings,\n      displaySettings: home.displaySettings,\n      menu: home.menu,\n      generatedAt: home.generatedAt\n    };\n  }\n}'
);
