import fs from "node:fs";
import path from "node:path";
import { isValidCmsLink } from "../cloudflare/public-api/src/adminLinkValidation.ts";

const directory = process.argv[2];
if (!directory) {
  throw new Error("usage: node scripts/audit-production-cms-links.mjs <audit-directory>");
}

function rows(file) {
  const value = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  const statements = Array.isArray(value) ? value : [value];
  return statements.flatMap((statement) => (Array.isArray(statement?.results) ? statement.results : []));
}

const invalid = [];
let checked = 0;

function check(table, id, field, value, kind, allowEmpty = true) {
  checked += 1;
  if (!isValidCmsLink(value, kind, allowEmpty)) {
    invalid.push(`${table}:${String(id || "unknown")}:${field}`);
  }
}

for (const row of rows("contents.json")) {
  check("contents", row.id, "canonical_url", row.canonical_url, "canonical");
  check("contents", row.id, "body_doc_url", row.body_doc_url, "resource");
}
for (const row of rows("documents.json")) {
  check("documents", row.id, "file_url", row.file_url, "resource", false);
}
for (const row of rows("home-sections.json")) {
  check("public_home_sections", row.id, "href", row.href, "navigation");
}
for (const row of rows("menu.json")) {
  check("menu_items", row.id, "href", row.href, "navigation", false);
}
for (const row of rows("carousel.json")) {
  check("carousel_slides", row.id, "image_url", row.image_url, "resource", false);
  check("carousel_slides", row.id, "mobile_image_url", row.mobile_image_url, "resource");
  check("carousel_slides", row.id, "href", row.href, "navigation");
}
for (const row of rows("external-services.json")) {
  check("external_services", row.id, "href", row.href, "navigation", false);
}
for (const row of rows("media.json")) {
  check("media_assets", row.id, "drive_url", row.drive_url, "resource");
  check("media_assets", row.id, "preview_url", row.preview_url, "resource");
  check("media_assets", row.id, "embed_url", row.embed_url, "resource");
  check("media_assets", row.id, "thumbnail_url", row.thumbnail_url, "resource");
}

function parseSettings(row, table) {
  if (!row?.settings_json) return null;
  try {
    return JSON.parse(row.settings_json);
  } catch {
    invalid.push(`${table}:${String(row.id || "unknown")}:settings_json`);
    return null;
  }
}

for (const row of rows("site-settings.json")) {
  const value = parseSettings(row, "site_settings");
  if (!value || typeof value !== "object") continue;
  for (const field of ["admissionUrl", "facebookUrl", "youtubeUrl", "tiktokUrl", "messengerUrl", "mapUrl"]) {
    check("site_settings", row.id, field, value[field], "navigation");
  }
  for (const field of ["heroImageUrl", "directorImageUrl", "mapEmbedUrl"]) {
    check("site_settings", row.id, field, value[field], "resource");
  }
  if (Array.isArray(value.footerDirectoryGroups)) {
    for (const [groupIndex, group] of value.footerDirectoryGroups.entries()) {
      if (!Array.isArray(group?.links)) continue;
      for (const [linkIndex, link] of group.links.entries()) {
        check(
          "site_settings",
          row.id,
          `footerDirectoryGroups[${groupIndex}].links[${linkIndex}].href`,
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
  check("homepage_settings", row.id, "introGate.imageUrl", value.introGate?.imageUrl, "resource");
  check(
    "homepage_settings",
    row.id,
    "introGate.secondaryButtonUrl",
    value.introGate?.secondaryButtonUrl,
    "navigation"
  );
  check("homepage_settings", row.id, "introVideo.youtubeEmbedUrl", value.introVideo?.youtubeEmbedUrl, "resource");
}

if (invalid.length > 0) {
  console.error(`CMS link integrity failed: ${invalid.length} invalid field(s). Values are intentionally not printed.`);
  invalid.slice(0, 100).forEach((item) => console.error(`- ${item}`));
  if (invalid.length > 100) console.error(`- ...and ${invalid.length - 100} more`);
  process.exit(1);
}

console.log(`CMS link integrity clean: ${checked} link field(s) checked; no URL values printed.`);
