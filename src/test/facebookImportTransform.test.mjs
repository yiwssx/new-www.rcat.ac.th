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

  it("includes the original Facebook URL in the body", () => {
    expect(rowFor(activityPost).body_snapshot).toContain("ที่มา: Facebook วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด");
    expect(rowFor(activityPost).body_snapshot).toContain(activityPost.permalink_url);
  });

  it("sets imported rows to published status by default", () => {
    expect(rowFor(activityPost).status).toBe("published");
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

    expect(sql).toMatch(
      /^-- D1 remote execute compatibility: explicit SQL transaction control statements are intentionally omitted\./u
    );
    expect(sql).toContain("INSERT OR IGNORE INTO contents");
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

  it("creates report CSV rows with expected import warnings", () => {
    const rows = transformFacebookPostsToContentRows(fixture, { generatedAt, status: "published" });
    const csv = createFacebookImportReportCsv(fixture, rows);

    expect(csv.split("\n")[0]).toBe(
      "source_id,publish_at,title,category,status,slug,source_url,has_message,has_image,warning"
    );
    expect(csv).toContain("100063746585360_444");
    expect(csv).toContain("short_or_missing_message");
  });
});
