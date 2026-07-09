import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/facebook-posts.sample.json";
import {
  createFacebookImportReportCsv,
  createFacebookPostsSql,
  transformFacebookPostToContentRow,
  transformFacebookPostsToContentRows
} from "../../scripts/facebook/transform-posts-to-d1-sql.mjs";

const generatedAt = "2026-07-09T00:00:00.000Z";
const [announcementPost, activityPost, procurementPost, shortPost, quotedPost] = fixture.posts;
const execFileAsync = promisify(execFile);
const minimalFacebookBody = "โพสต์นี้แสดงจาก Facebook ต้นฉบับ";

function rowFor(post, options = {}) {
  return transformFacebookPostToContentRow(post, {
    generatedAt,
    pageId: fixture.pageId,
    status: "published",
    ...options
  });
}

describe("Facebook post D1 content transform", () => {
  it("uses the first meaningful Thai line as the title", () => {
    expect(rowFor(announcementPost).title).toBe("ประกาศรับสมัครนักเรียน นักศึกษาใหม่ ประจำปีการศึกษา 2567");
  });

  it("uses the fallback Thai title for empty or too-short messages", () => {
    expect(rowFor(shortPost).title).toBe("ข่าวประชาสัมพันธ์จากวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด");
  });

  it("classifies announcement text as ประกาศ", () => {
    expect(rowFor(announcementPost).category).toBe("ประกาศ");
  });

  it("classifies activity text as กิจกรรม", () => {
    expect(rowFor(activityPost).category).toBe("กิจกรรม");
  });

  it("classifies procurement text as จัดซื้อจัดจ้าง before generic announcements", () => {
    expect(rowFor(procurementPost).category).toBe("จัดซื้อจัดจ้าง");
  });

  it("stores Facebook imports as embed metadata with a minimal fallback body", () => {
    const row = rowFor(activityPost);

    expect(row.template).toBe("facebook-embed");
    expect(row.canonical_url).toBe(activityPost.permalink_url);
    expect(row.reading_minutes).toBe(1);
    expect(row.featured).toBe(0);
    expect(row.owner).toBe("facebook-import");
    expect(row.featured_media_id).toBe("");
    expect(row.media_ids_json).toBe("[]");
    expect(row.body_snapshot).toBe(`${minimalFacebookBody}\n\nที่มา: ${activityPost.permalink_url}`);
    expect(row.body_snapshot).toContain(activityPost.permalink_url);
    expect(row.body_snapshot).not.toContain(activityPost.message);
  });

  it("keeps the original Facebook URL in the minimal body fallback", () => {
    expect(rowFor(activityPost).body_snapshot).toContain(minimalFacebookBody);
    expect(rowFor(activityPost).body_snapshot).toContain(activityPost.permalink_url);
  });

  it("sets imported rows to published status by default", () => {
    expect(rowFor(activityPost).status).toBe("published");
  });

  it("allows the import owner to be overridden", () => {
    expect(rowFor(activityPost, { owner: "facebook-preview-import" }).owner).toBe("facebook-preview-import");
  });

  it("escapes single quotes safely in generated SQL", () => {
    const sql = createFacebookPostsSql(
      {
        ...fixture,
        posts: [quotedPost]
      },
      { generatedAt, status: "published" }
    );

    expect(sql).toContain("ช่างยนต์''s day");
    expect(sql).not.toContain("ช่างยนต์'s day ได้รับ");
  });

  it("uses duplicate-safe INSERT OR IGNORE statements", () => {
    const sql = createFacebookPostsSql(fixture, { generatedAt, status: "published" });
    const insertStatements = sql.match(/INSERT OR IGNORE INTO contents \([^)]+\) VALUES \([\s\S]*?\);/gu) ?? [];

    expect(sql).toMatch(
      /^-- D1 remote execute compatibility: explicit SQL transaction control statements are intentionally omitted; one INSERT per post avoids SQLITE_TOOBIG on D1 remote import\./u
    );
    expect(insertStatements).toHaveLength(fixture.posts.length);
    insertStatements.forEach((statement) => {
      expect(statement.trim().endsWith(";")).toBe(true);
    });
    expect(sql).toContain("INSERT OR IGNORE INTO contents");
    expect(sql).not.toMatch(/\)\s*,\s*\n\s*\(/u);
    expect(sql).not.toMatch(/^\s*BEGIN\s+TRANSACTION\s*;/imu);
    expect(sql).not.toMatch(/^\s*COMMIT\s*;/imu);
    expect(sql).not.toMatch(/^\s*SAVEPOINT\b/imu);
    expect(sql).not.toMatch(/^\s*RELEASE\b/imu);
    expect(sql).not.toMatch(/^\s*ROLLBACK\b/imu);
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });

  it("preserves publish_at from Facebook created_time as ISO timestamps", () => {
    expect(rowFor(announcementPost).publish_at).toBe("2024-01-15T08:30:00.000Z");
    expect(rowFor(announcementPost).created_at).toBe(rowFor(announcementPost).publish_at);
  });

  it("creates valid JSON tags from hashtags and keywords", () => {
    const tags = JSON.parse(rowFor(announcementPost).tags_json);

    expect(tags).toContain("รับสมัคร");
    expect(tags).toContain("RCAT");
    expect(tags).toContain("ประกาศ");
  });

  it("creates deterministic IDs and slugs from Facebook post IDs", () => {
    expect(rowFor(announcementPost)).toMatchObject({
      id: "facebook-post-100063746585360-111",
      slug: "facebook-100063746585360-111"
    });
  });

  it("creates report CSV rows with template, permalink flags, and expected import warnings", () => {
    const warningFixture = {
      ...fixture,
      posts: [
        {
          ...shortPost,
          message: "",
          permalink_url: ""
        }
      ]
    };
    const rows = transformFacebookPostsToContentRows(warningFixture, { generatedAt, status: "published" });
    const csv = createFacebookImportReportCsv(warningFixture, rows);

    expect(csv.split("\n")[0]).toBe(
      "source_id,publish_at,title,category,status,slug,source_url,template,has_message,has_permalink,warning"
    );
    expect(csv).toContain("100063746585360_444");
    expect(csv).toContain("facebook-embed");
    expect(csv).toContain("no,no,missing_message|missing_permalink|skipped_missing_permalink|fallback_title");
  });

  it("does not articleize long Facebook messages into body_snapshot and warns when summary is truncated", () => {
    const longPost = {
      ...activityPost,
      id: "100063746585360_999",
      message: `${"กิจกรรมวิทยาลัย ".repeat(80)}ข้อความท้ายที่ไม่ควรอยู่หลังการย่อ`,
      permalink_url: "https://www.facebook.com/100063746585360/posts/999"
    };
    const longFixture = {
      ...fixture,
      posts: [longPost]
    };
    const rows = transformFacebookPostsToContentRows(longFixture, {
      generatedAt,
      maxBodyChars: 120,
      status: "published"
    });
    const csv = createFacebookImportReportCsv(longFixture, rows);

    expect(rows[0].body_snapshot).toBe(`${minimalFacebookBody}\n\nที่มา: ${longPost.permalink_url}`);
    expect(rows[0].body_snapshot).toContain(longPost.permalink_url);
    expect(rows[0].body_snapshot).not.toContain("ข้อความท้ายที่ไม่ควรอยู่หลังการย่อ");
    expect(rows[0].summary.length).toBeLessThanOrEqual(213);
    expect(csv).toContain("summary_truncated");
  });

  it("skips rows with missing Facebook permalinks while keeping the report warning", () => {
    const missingPermalinkFixture = {
      ...fixture,
      posts: [
        {
          ...activityPost,
          permalink_url: ""
        }
      ]
    };

    expect(transformFacebookPostsToContentRows(missingPermalinkFixture, { generatedAt, status: "published" })).toEqual(
      []
    );
    expect(createFacebookPostsSql(missingPermalinkFixture, { generatedAt, status: "published" })).not.toContain(
      "INSERT OR IGNORE INTO contents"
    );
    expect(createFacebookImportReportCsv(missingPermalinkFixture)).toContain(
      "missing_permalink|skipped_missing_permalink"
    );
  });

  it("writes batch SQL part files and a manifest according to batch-size", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "facebook-d1-transform-"));

    try {
      const inputPath = path.join(tempDir, "facebook-posts.raw.json");
      const outputPath = path.join(tempDir, "facebook-news-2023-2026.sql");
      const manifestPath = path.join(tempDir, "facebook-news-2023-2026.manifest.json");
      const partOnePath = path.join(tempDir, "facebook-news-2023-2026.part-001.sql");
      const partTwoPath = path.join(tempDir, "facebook-news-2023-2026.part-002.sql");
      const partThreePath = path.join(tempDir, "facebook-news-2023-2026.part-003.sql");

      await writeFile(inputPath, JSON.stringify(fixture), "utf8");
      await execFileAsync(process.execPath, [
        path.resolve("scripts/facebook/transform-posts-to-d1-sql.mjs"),
        "--input",
        inputPath,
        "--output",
        outputPath,
        "--status",
        "published",
        "--batch-size",
        "2",
        "--max-body-chars",
        "12000"
      ]);

      const [partOneSql, partTwoSql, partThreeSql, manifestJson] = await Promise.all([
        readFile(partOnePath, "utf8"),
        readFile(partTwoPath, "utf8"),
        readFile(partThreePath, "utf8"),
        readFile(manifestPath, "utf8")
      ]);
      const manifest = JSON.parse(manifestJson);

      expect(partOneSql.match(/^INSERT OR IGNORE INTO contents/gmu)).toHaveLength(2);
      expect(partTwoSql.match(/^INSERT OR IGNORE INTO contents/gmu)).toHaveLength(2);
      expect(partThreeSql.match(/^INSERT OR IGNORE INTO contents/gmu)).toHaveLength(1);
      expect(manifest).toMatchObject({
        input: inputPath.replaceAll("\\", "/"),
        totalRows: fixture.posts.length,
        batchSize: 2,
        files: [
          { path: partOnePath.replaceAll("\\", "/"), rows: 2 },
          { path: partTwoPath.replaceAll("\\", "/"), rows: 2 },
          { path: partThreePath.replaceAll("\\", "/"), rows: 1 }
        ]
      });
      expect(Date.parse(manifest.generatedAt)).not.toBeNaN();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
