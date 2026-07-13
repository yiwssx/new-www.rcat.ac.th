import { describe, expect, it } from "vitest";
import { finalizeSlug, sanitizeSlugInput, slugify } from "../utils/slug";

describe("Unicode slug utilities", () => {
  it.each([
    ["ลม", "ลม"],
    ["ข่าว", "ข่าว"],
    ["รับสมัคร", "รับสมัคร"],
    ["วิจัยและนวัตกรรม", "วิจัยและนวัตกรรม"],
    ["การประเมินคุณธรรม", "การประเมินคุณธรรม"],
    ["น้ำเพื่อการเกษตร", "น้ำเพื่อการเกษตร"],
    ["ข่าว รับสมัคร 2569", "ข่าว-รับสมัคร-2569"],
    ["วิจัย/นวัตกรรม & (เทคโนโลยี)!", "วิจัย-นวัตกรรม-เทคโนโลยี"],
    ["ข่าว   ประชาสัมพันธ์", "ข่าว-ประชาสัมพันธ์"],
    ["---ข่าว---รับสมัคร---", "ข่าว-รับสมัคร"],
    ["ข่าว😀★รับสมัคร", "ข่าว-รับสมัคร"],
    ["Student Life Updates", "student-life-updates"],
    ["RCAT-NEWS-2569", "rcat-news-2569"],
    ["ข่าว__รับสมัคร", "ข่าว-รับสมัคร"],
    ["", ""],
    ["   ", ""]
  ])("slugifies %j as %j", (value, expected) => {
    expect(slugify(value)).toBe(expected);
  });

  it("normalizes canonically equivalent text to the same NFC slug", () => {
    const precomposed = slugify("École");
    const decomposed = slugify("E\u0301cole");

    expect(precomposed).toBe("école");
    expect(decomposed).toBe("école");
    expect(decomposed).toBe(precomposed);
    expect(decomposed).toBe(decomposed.normalize("NFC"));
  });

  it("retains one trailing hyphen while editing and removes it when finalized", () => {
    expect(sanitizeSlugInput("ข่าว---")).toBe("ข่าว-");
    expect(finalizeSlug("ข่าว---")).toBe("ข่าว");
  });

  it("preserves every Thai combining mark in valid text", () => {
    const value = "ข่าว รับสมัคร น้ำเพื่อการเกษตร วิจัยและนวัตกรรม";
    const expected = "ข่าว-รับสมัคร-น้ำเพื่อการเกษตร-วิจัยและนวัตกรรม";
    const sourceMarks = Array.from(value.normalize("NFC")).filter((character) => /\p{Mark}/u.test(character));
    const slug = slugify(value);
    const slugMarks = Array.from(slug).filter((character) => /\p{Mark}/u.test(character));

    expect(slug).toBe(expected);
    expect(slugMarks).toEqual(sourceMarks);
  });

  it("converts non-string values safely", () => {
    expect(slugify(2569)).toBe("2569");
    expect(slugify(null)).toBe("");
  });
});
