/* global console, process */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryChecks = [
  {
    name: "publicProviderDefault",
    file: "src/config/publicApiProvider.ts",
    patterns: [/provider === "cloudflare" \? "cloudflare" : "apps-script"/]
  },
  {
    name: "publicReadProviderParity",
    file: "src/features/public-read/cloudflareApi.ts",
    patterns: [
      /getPublicHomeSnapshotFromCloudflare/,
      /getPublicContentListSnapshotFromCloudflare/,
      /getContentDetailFromCloudflare/,
      /getPublicProgramListSnapshotFromCloudflare/,
      /getPublicSearchIndexSnapshotFromCloudflare/
    ]
  },
  {
    name: "workerPublicMetadataParity",
    file: "cloudflare/public-api/src/db/publicMetadataRepository.ts",
    patterns: [/site_settings/, /menu_items/, /carousel_slides/, /external_services/, /events/, /media_assets/]
  },
  {
    name: "structuredAdminRoutes",
    file: "cloudflare/public-api/src/routes/adminStructuredParity.ts",
    patterns: [/settings/, /menu/, /carousel/, /external-services/, /events/]
  },
  {
    name: "structuredAdminFrontendProvider",
    file: "src/features/admin-write/cloudflareApi.ts",
    patterns: [
      /saveSiteSettingsToCloudflare/,
      /savePublicMenuItemsToCloudflare/,
      /saveCarouselSlideToCloudflare/,
      /saveExternalServiceLinkToCloudflare/,
      /saveCalendarEventToCloudflare/
    ]
  },
  {
    name: "structuredAdminAuditMigration",
    file: "cloudflare/public-api/migrations/0005_m19_structured_admin_parity.sql",
    patterns: [/AFTER INSERT ON site_settings/, /AFTER UPDATE ON menu_items/, /AFTER DELETE ON events/]
  },
  {
    name: "placeholderSafeWorkerConfig",
    file: "cloudflare/public-api/wrangler.toml",
    patterns: [
      /database_id\s*=\s*"production-placeholder"/,
      /\[env\.production\.vars\][\s\S]*ADMIN_WRITE_PREVIEW_ENABLED\s*=\s*"false"/
    ]
  },
  {
    name: "mediaBridgeBoundary",
    file: "src/features/cms-media/api.ts",
    patterns: [/saveMediaAssetToBridge/, /uploadMediaAssetToBridge/, /deleteMediaAssetFromBridge/]
  }
];

export async function runM19ParityReadiness(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const read = options.readFile ?? readFile;
  const checks = {};
  const validationIssues = [];

  for (const check of repositoryChecks) {
    let source = "";

    try {
      source = await read(path.resolve(cwd, check.file), "utf8");
    } catch {
      validationIssues.push(`${check.name}: required repository file is unavailable`);
    }

    const passed = source.length > 0 && check.patterns.every((pattern) => pattern.test(source));
    checks[check.name] = passed ? "passed" : "blocked";

    if (!passed && !validationIssues.some((issue) => issue.startsWith(`${check.name}:`))) {
      validationIssues.push(`${check.name}: repository parity invariant is missing`);
    }
  }

  return {
    checkpoint: "M19",
    status: validationIssues.length ? "BLOCKED" : "REPOSITORY_READY",
    checks,
    externalOperatorBlockers: [
      "production identity and RBAC approval",
      "sanitized source-data inventory and reconciliation",
      "Google Drive bridge ownership and recovery approval",
      "production resources, monitoring, rollback, and cutover approval"
    ],
    safety: {
      remoteCommandsRun: false,
      d1Writes: false,
      workerDeploy: false,
      vercelMutation: false,
      appsScriptMutation: false,
      googleDriveMutation: false,
      productionCutover: false
    },
    validationIssues
  };
}

export function formatM19ParityReadiness(result) {
  const lines = [result.status, "", "Repository checks:"];

  Object.entries(result.checks).forEach(([name, status]) => {
    lines.push(`- ${name}: ${status}`);
  });
  lines.push("", "External operator blockers:");
  result.externalOperatorBlockers.forEach((blocker) => lines.push(`- ${blocker}`));

  if (result.validationIssues.length) {
    lines.push("", "Repository validation issues:");
    result.validationIssues.forEach((issue) => lines.push(`- ${issue}`));
  }

  lines.push("", "No remote commands were run.");
  return lines.join("\n");
}

export async function main() {
  const result = await runM19ParityReadiness();
  console.log(formatM19ParityReadiness(result));
  process.exitCode = result.status === "REPOSITORY_READY" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
