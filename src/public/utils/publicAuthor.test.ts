import { describe, expect, it } from "vitest";
import { getPublicAuthorLabel } from "./publicAuthor";

describe("getPublicAuthorLabel", () => {
  it("retains meaningful editorial attribution", () => {
    expect(getPublicAuthorLabel("งานประชาสัมพันธ์")).toBe("งานประชาสัมพันธ์");
    expect(getPublicAuthorLabel(" ฝ่ายวิชาการ ")).toBe("ฝ่ายวิชาการ");
  });

  it("hides technical author placeholders from public pages", () => {
    for (const name of ["Admin", "ADMIN", "CMS", "ผู้แก้ไข CMS", "facebook-import", "", undefined]) {
      expect(getPublicAuthorLabel(name)).toBe("");
    }
  });
});
