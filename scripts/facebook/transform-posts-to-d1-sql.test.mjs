import { describe, expect, it } from "vitest";
import { transformFacebookPostToContentRow } from "./transform-posts-to-d1-sql.mjs";

describe("Facebook SQL transform metadata", () => {
  it("uses the shared classifier for category and tags", () => {
    const row = transformFacebookPostToContentRow(
      {
        id: "1609435494524655_999",
        message: "ประกาศเปิดรับสมัครนักเรียนเข้าร่วมการแข่งขันทักษะวิชาชีพ #RCAT #ทักษะวิชาชีพ",
        created_time: "2026-08-01T00:00:00+0000",
        permalink_url: "https://www.facebook.com/1609435494524655/posts/999"
      },
      { generatedAt: "2026-08-01T01:00:00.000Z" }
    );

    expect(row.category).toBe("ประกาศ");
    expect(JSON.parse(row.tags_json)).toEqual(
      expect.arrayContaining(["รับสมัคร", "นักเรียน", "การแข่งขัน", "ทักษะวิชาชีพ"])
    );
    expect(JSON.parse(row.tags_json)).not.toContain("ผลงานและรางวัล");
    expect(JSON.parse(row.tags_json)).not.toContain("RCAT");
  });
});
