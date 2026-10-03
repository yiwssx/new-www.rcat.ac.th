// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporaryDirectories = [];

function makeAuditDirectory(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rcat-cms-integrity-"));
  temporaryDirectories.push(directory);

  const defaults = {
    "contents.json": [],
    "documents.json": [],
    "home-sections.json": [],
    "menu.json": [],
    "carousel.json": [],
    "external-services.json": [],
    "media.json": [],
    "site-settings.json": [],
    "homepage-settings.json": []
  };

  for (const [file, results] of Object.entries({ ...defaults, ...files })) {
    fs.writeFileSync(path.join(directory, file), JSON.stringify({ results }));
  }

  return directory;
}

function runAudit(directory) {
  return spawnSync(process.execPath, ["scripts/audit-production-cms-links.mjs", directory], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CMS_INTEGRITY_AUDIT_NOW: "2026-10-03T04:00:00.000Z"
    }
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe("production CMS integrity audit", () => {
  it("passes a clean read-only snapshot", () => {
    const directory = makeAuditDirectory({
      "contents.json": [
        {
          id: "content-1",
          slug: "example",
          type: "news",
          status: "published",
          owner: "Editorial",
          title: "Example",
          canonical_url: "https://www.rcat.ac.th/content/example",
          template: "standard",
          body_doc_id: "",
          body_doc_url: "",
          featured_media_id: "",
          media_ids_json: "[]",
          publish_at: "2026-10-03T03:00:00.000Z",
          deleted_at: ""
        }
      ],
      "documents.json": [
        {
          id: "document-1",
          title: "Document",
          file_url: "https://drive.google.com/file/d/example/view",
          media_id: "",
          status: "published",
          deleted_at: ""
        }
      ],
      "menu.json": [{ id: "menu-1", parent_id: "", href: "/content/example", enabled: 1 }]
    });

    const result = runAudit(directory);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("CMS integrity audit clean");
    expect(result.stdout).toContain("record identifiers are not printed");
  });

  it("fails closed with aggregate findings and never prints record identifiers or URL values", () => {
    const secretId = "secret-record-id-123";
    const secretUrl = "javascript:secret-payload-456";
    const directory = makeAuditDirectory({
      "contents.json": [
        {
          id: secretId,
          slug: "duplicate",
          type: "news",
          status: "published",
          owner: "Editorial",
          title: "One",
          canonical_url: secretUrl,
          template: "facebook-embed",
          body_doc_id: "",
          body_doc_url: "",
          featured_media_id: "",
          media_ids_json: "[]",
          publish_at: "2026-10-03T03:00:00.000Z",
          deleted_at: ""
        },
        {
          id: "secret-record-id-789",
          slug: " DUPLICATE ",
          type: "news",
          status: "published",
          owner: "Editorial",
          title: "Two",
          canonical_url: "",
          template: "standard",
          body_doc_id: "",
          body_doc_url: "",
          featured_media_id: "",
          media_ids_json: "[]",
          publish_at: "2026-10-03T03:00:00.000Z",
          deleted_at: ""
        }
      ]
    });

    const result = runAudit(directory);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CMS integrity audit failed");
    expect(result.stderr).toContain("link-invalid:contents:canonical_url");
    expect(result.stderr).toContain("semantic:content-facebook-permalink-invalid");
    expect(result.stderr).toContain("semantic:content-slug-duplicate");
    expect(output).not.toContain(secretId);
    expect(output).not.toContain("secret-record-id-789");
    expect(output).not.toContain(secretUrl);
  });
});
