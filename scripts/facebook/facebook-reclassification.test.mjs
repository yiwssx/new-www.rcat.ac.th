import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAudit } from "./reclassify-facebook-imports.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createFixtureFiles() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rcat-facebook-reclass-"));
  temporaryDirectories.push(directory);

  const d1Path = path.join(directory, "d1.json");
  const facebookPath = path.join(directory, "facebook.json");
  const outputDir = path.join(directory, "result");
  const d1Payload = [
    {
      results: [
        {
          id: "facebook-post-1609435494524655-111",
          slug: "facebook-1609435494524655-111",
          title: "ประกาศรับสมัครนักเรียนเข้าร่วมการแข่งขัน",
          summary: "ประกาศรับสมัครนักเรียนเข้าร่วมการแข่งขันทักษะวิชาชีพ",
          category: "ผลงานและรางวัล",
          tags_json: '["ผลงานและรางวัล","รางวัล"]',
          canonical_url: "https://www.facebook.com/1609435494524655/posts/111",
          template: "facebook-embed",
          owner: "facebook-import",
          created_by: "facebook-import",
          revision: 4,
          publish_at: "2026-01-02T03:04:05.000Z"
        },
        {
          id: "manual-news-1",
          slug: "manual-news-1",
          title: "Manual",
          summary: "Manual",
          category: "ข่าวประชาสัมพันธ์",
          tags_json: "[]",
          template: "default",
          owner: "admin",
          created_by: "admin",
          revision: 1,
          publish_at: "2026-01-02T03:04:05.000Z"
        }
      ]
    }
  ];
  const facebookPayload = {
    pageId: "1609435494524655",
    since: "2026-01-01",
    until: "2026-01-03",
    errors: [],
    posts: [
      {
        id: "1609435494524655_111",
        message: "ประกาศรับสมัครนักเรียนเข้าร่วมการแข่งขันทักษะวิชาชีพ #นักเรียน",
        created_time: "2026-01-02T03:04:05+0000",
        permalink_url: "https://www.facebook.com/1609435494524655/posts/111"
      }
    ]
  };

  await writeFile(d1Path, `${JSON.stringify(d1Payload)}\n`, "utf8");
  await writeFile(facebookPath, `${JSON.stringify(facebookPayload)}\n`, "utf8");

  return { d1Path, facebookPath, outputDir };
}

describe("Facebook bulk reclassification", () => {
  it("repairs only Facebook imports and writes guarded SQL", async () => {
    const fixture = await createFixtureFiles();
    const result = await runAudit({ ...fixture, batchSize: 100 });

    expect(result.summary.totalFacebookImports).toBe(1);
    expect(result.summary.matched).toBe(1);
    expect(result.summary.changed).toBe(1);
    expect(result.reportRows[0].proposedCategory).toBe("ประกาศ");
    expect(result.reportRows[0].proposedTags).toContain("รับสมัคร");
    expect(result.reportRows[0].proposedTags).not.toContain("รางวัล");

    const sql = await readFile(path.join(fixture.outputDir, "repair.sql"), "utf8");
    expect(sql).toContain("template = 'facebook-embed'");
    expect(sql).toContain("owner = 'facebook-import'");
    expect(sql).toContain("COALESCE(revision, 0) = 4");
    expect(sql).toContain("category IS 'ผลงานและรางวัล'");
  });

  it("uses D1 title and summary only as a lower-confidence fallback", async () => {
    const fixture = await createFixtureFiles();
    const facebookPayload = JSON.parse(await readFile(fixture.facebookPath, "utf8"));
    facebookPayload.posts = [];
    await writeFile(fixture.facebookPath, `${JSON.stringify(facebookPayload)}\n`, "utf8");

    const result = await runAudit({ ...fixture, batchSize: 100 });

    expect(result.summary.unmatched).toBe(1);
    expect(result.summary.d1Fallback).toBe(1);
    expect(result.reportRows[0].sourceKind).toBe("d1-fallback");
    expect(result.reportRows[0].confidence).toBeLessThanOrEqual(0.72);
    expect(result.reportRows[0].eligibleForRepair).toBe(true);
  });
});
