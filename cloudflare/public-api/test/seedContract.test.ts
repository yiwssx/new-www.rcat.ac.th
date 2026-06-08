import { describe, expect, it } from "vitest";
import packageJson from "../../../package.json";
import sample from "../seed/public-documents.sample.json";
import seedSql from "../seed/public-documents.seed.sql?raw";
import wranglerToml from "../wrangler.toml?raw";
import { DOCUMENT_ROW_COLUMNS } from "../src/db/schema";
import worker from "../src/index";

function getInsertColumns(sql: string) {
  const match = /INSERT\s+INTO\s+documents\s*\(([^)]*)\)/i.exec(sql);

  expect(match, "seed SQL should insert into documents with an explicit column list").not.toBeNull();

  return match?.[1].split(",").map((column) => column.trim().replaceAll('"', ""));
}

describe("M2.2 local D1 fake seed contract", () => {
  it("configures only a clearly local placeholder D1 binding", () => {
    expect(wranglerToml).toMatch(/^\[\[d1_databases\]\]/m);
    expect(wranglerToml).toMatch(/^\s*binding\s*=\s*"DB"\s*$/m);
    expect(wranglerToml).toMatch(/^\s*database_name\s*=\s*"rcat-public-api-local"\s*$/m);
    expect(wranglerToml).toMatch(/^\s*database_id\s*=\s*"local-placeholder"\s*$/m);
    expect(wranglerToml).toMatch(/local\/non-production/i);
  });

  it("defines safe local D1 package scripts", () => {
    expect(packageJson.scripts["worker:d1:migrate:local"]).toBe(
      "wrangler d1 migrations apply rcat-public-api-local --local --config cloudflare/public-api/wrangler.toml"
    );
    expect(packageJson.scripts["worker:d1:seed:local"]).toBe(
      "wrangler d1 execute rcat-public-api-local --local --file cloudflare/public-api/seed/public-documents.seed.sql --config cloudflare/public-api/wrangler.toml"
    );
    expect(packageJson.scripts["worker:d1:list:local"]).toBe(
      'wrangler d1 execute rcat-public-api-local --local --command "SELECT id, title, status, pinned, sort_order FROM documents ORDER BY pinned DESC, sort_order ASC, published_at DESC" --config cloudflare/public-api/wrangler.toml'
    );
  });

  it("uses repeatable fake sample IDs and inserts into documents only", () => {
    expect(seedSql).toMatch(/DELETE\s+FROM\s+documents\s+WHERE\s+id\s+LIKE\s+'sample-%';/i);
    expect(seedSql).toMatch(/INSERT\s+INTO\s+documents\s*\(/i);
    expect(seedSql).not.toMatch(/\bINSERT\s+INTO\s+(?!documents\b)[a-z_]+/i);
    expect(seedSql).not.toMatch(/\bDELETE\s+FROM\s+(?!documents\b)[a-z_]+/i);

    const insertedIds = Array.from(seedSql.matchAll(/'([^']*)'/g))
      .map((match) => match[1])
      .filter((value) => value.includes("document"));

    expect(insertedIds.length).toBeGreaterThan(0);
    insertedIds.forEach((id) => {
      expect(id).toMatch(/^sample-/);
    });
  });

  it("keeps seed SQL columns aligned with DOCUMENT_ROW_COLUMNS", () => {
    expect(getInsertColumns(seedSql)).toEqual(DOCUMENT_ROW_COLUMNS);
  });

  it("keeps seed SQL fake-only and limited to example.test URLs", () => {
    const urls = Array.from(seedSql.matchAll(/https?:\/\/[^'\s)]+/g)).map((match) => match[0]);

    expect(seedSql).not.toMatch(/rcat\.ac\.th|script\.google\.com|drive\.google\.com/i);
    expect(seedSql).not.toMatch(/\b(users|user_accounts|auth|sessions|admin|media_uploads)\b/i);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => {
      expect(new URL(url).hostname).toMatch(/(^|\.)example\.test$/);
    });
  });

  it("keeps sample JSON marked sample-only with document row keys", () => {
    const typedSample = sample as {
      sampleOnly?: boolean;
      rows?: Array<Record<string, unknown>>;
    };

    expect(typedSample.sampleOnly).toBe(true);
    expect(typedSample.rows?.length).toBeGreaterThan(0);
    typedSample.rows?.forEach((row) => {
      expect(Object.keys(row)).toEqual(DOCUMENT_ROW_COLUMNS);
    });
  });

  it("keeps the public documents route at 501 while local D1 is only provisioned", async () => {
    const response = await worker.fetch(new Request("https://public-api.example.test/api/public/documents"), {});

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: "public-document-list is not implemented in M1 skeleton",
      resource: "public-document-list",
      phase: "M1"
    });
  });
});
