import fs from "node:fs";
import path from "node:path";

import { isValidCmsLink } from "../cloudflare/public-api/src/adminLinkValidation.ts";
import { auditContentIntegrity } from "../cloudflare/public-api/src/contentIntegrity.ts";

const directory = process.argv[2];
if (!directory) {
  throw new Error(
    "usage: node scripts/audit-production-cms-links.mjs <audit-directory>"
  );
}

function rows(file) {
  const value = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  const statements = Array.isArray(value) ? value : [value];
  return statements.flatMap((statement) =>
    Array.isArray(statement?.results) ? statement.results : []
  );
}

const findings = new Map();
let checkedLinks = 0;

function record(code, count = 1) {
  findings.set(code, (findings.get(code) ?? 0) + count);
}

function check(table, field, value, kind, allowEmpty = true) {
  checkedLinks += 1;
  if (!isValidCmsLink(value, kind, allowEmpty)) {
    record(`link-invalid:${table}:${field}`);
  }
}

const contents = rows("contents.json");
const documents = rows("documents.json");
const menuItems = rows("menu.json");
const mediaAssets = rows("media.json");

for (const row of contents) {
  check("contents", "canonical_url", row.canonical_url, "canonical");
  check("contents", "body_doc_url", row.body_doc_url, "resource");
}
for (const row of documents) {
  check("documents", "file_url", row.file_url, "resource", false);
}
for (const row of rows("home-sections.json")) {
  check("public_home_sections", "href", row.href, "navigation");
}
for (const row of menuItems) {
  check("menu_items", "href", row.href, "navigation", false);
}
for (const row of rows("carousel.json")) {
  check("carousel_slides", "image_url", row.image_url, "resource", false);
  check(
    "carousel_slides",
    "mobile_image_url",
    row.mobile_image_url,
    "resource"
  );
  check("carousel_slides", "href", row.href, "navigation");
}
for (const row of rows("external-services.json")) {
  check("external_services", "href", row.href, "navigation", false);
}
for (const row of mediaAssets) {
  check("media_assets", "drive_url", row.drive_url, "resource");
  check("media_assets", "preview_url", row.preview_url, "resource");
  check("media_assets", "embed_url", row.embed_url, "resource");
  check("media_assets", "thumbnail_url", row.thumbnail_url, "resource");
}

function parseSettings(row, table) {
  if (!row?.settings_json) return null;
  try {
    return JSON.parse(row.settings_json);
  } catch {
    record(`settings-json-invalid:${table}`);
    return null;
  }
}

for (const row of rows("site-settings.json")) {
  const value = parseSettings(row, "site_settings");
  if (!value || typeof value !== "object") continue;
  for (const field of [
    "admissionUrl",
    "facebookUrl",
    "youtubeUrl",
    "tiktokUrl",
    "messengerUrl",
    "mapUrl"
  ]) {
    check("site_settings", field, value[field], "navigation");
  }
  for (const field of ["heroImageUrl", "directorImageUrl", "mapEmbedUrl"]) {
    check("site_settings", field, value[field], "resource");
  }
  if (Array.isArray(value.footerDirectoryGroups)) {
    for (const group of value.footerDirectoryGroups) {
      if (!Array.isArray(group?.links)) continue;
      for (const link of group.links) {
        check(
          "site_settings",
          "footerDirectoryGroups.href",
          link?.href,
          "navigation"
        );
      }
    }
  }
}

for (const row of rows("homepage-settings.json")) {
  const value = parseSettings(row, "homepage_settings");
  if (!value || typeof value !== "object") continue;
  check(
    "homepage_settings",
    "introGate.imageUrl",
    value.introGate?.imageUrl,
    "resource"
  );
  check(
    "homepage_settings",
    "introGate.secondaryButtonUrl",
    value.introGate?.secondaryButtonUrl,
    "navigation"
  );
  check(
    "homepage_settings",
    "introVideo.youtubeEmbedUrl",
    value.introVideo?.youtubeEmbedUrl,
    "resource"
  );
}

const auditNow =
  process.env.CMS_INTEGRITY_AUDIT_NOW || new Date().toISOString();
const semantic = auditContentIntegrity({
  now: auditNow,
  contents,
  documents,
  mediaAssets,
  menuItems
});

for (const item of semantic.issues) {
  record(`semantic:${item.code}`);
}

const findingCount = [...findings.values()].reduce(
  (total, count) => total + count,
  0
);
if (findingCount > 0) {
  console.error(
    `CMS integrity audit failed: ${findingCount} finding(s); ${checkedLinks} link field(s) and ${semantic.checked.contents + semantic.checked.documents + semantic.checked.mediaAssets + semantic.checked.menuItems} semantic row(s) checked. Sensitive values and record identifiers are intentionally not printed.`
  );
  [...findings.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([code, count]) => console.error(`- ${code}: ${count}`));
  process.exit(1);
}

console.log(
  `CMS integrity audit clean: ${checkedLinks} link field(s) and ${semantic.checked.contents + semantic.checked.documents + semantic.checked.mediaAssets + semantic.checked.menuItems} semantic row(s) checked; sensitive values and record identifiers are not printed.`
);
