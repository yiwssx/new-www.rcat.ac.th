import { describe, expect, it } from "vitest";
import { classifyFacebookContent, extractFacebookHashtags } from "./facebook-content-classifier.mjs";

describe("Facebook content classifier", () => {
  it.each([
    ["ประกาศรับสมัครนักเรียนเข้าร่วมการแข่งขันทักษะวิชาชีพ", "ประกาศ"],
    ["เปิดรับสมัครนักเรียนเข้าร่วมประกวดโครงงานวิทยาศาสตร์", "ประกาศ"],
    ["ประกาศผู้ชนะการเสนอราคา ซื้อวัสดุการเกษตร โดยวิธีเฉพาะเจาะจง", "จัดซื้อจัดจ้าง"],
    ["นักเรียนได้รับรางวัลชนะเลิศการแข่งขันทักษะวิชาชีพ", "ผลงานและรางวัล"],
    ["จัดโครงการฝึกอบรมเชิงปฏิบัติการพัฒนาทักษะดิจิทัล", "อบรม/โครงการ"],
    ["คณะครูและนักเรียนเข้าร่วมกิจกรรมจิตอาสา", "กิจกรรม"],
    ["คณะผู้บริหารเข้าร่วมประชุมหัวหน้าส่วนราชการ", "กิจกรรม"],
    ["การประเมินคุณธรรมและความโปร่งใส ITA ประจำปี", "ITA/คุณธรรมและความโปร่งใส"],
    ["วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ขอประชาสัมพันธ์ข่าวสารทั่วไป", "ข่าวประชาสัมพันธ์"]
  ])("classifies %s", (text, expectedCategory) => {
    expect(classifyFacebookContent(text).category).toBe(expectedCategory);
  });

  it("does not treat a competition mention as an award without an award outcome", () => {
    const result = classifyFacebookContent("นักเรียนเข้าร่วมการแข่งขันทักษะวิชาชีพระดับจังหวัด");

    expect(result.category).toBe("กิจกรรม");
    expect(result.tags).toContain("การแข่งขัน");
    expect(result.tags).not.toContain("รางวัล");
  });

  it("keeps semantic tags separate from the primary category", () => {
    const result = classifyFacebookContent("ประกาศเปิดรับสมัครนักเรียนเข้าร่วมโครงการอบรม #RCAT #ดิจิทัล");

    expect(result.category).toBe("ประกาศ");
    expect(result.tags).toContain("รับสมัคร");
    expect(result.tags).toContain("นักเรียน");
    expect(result.tags).toContain("โครงการ");
    expect(result.tags).toContain("อบรม");
    expect(result.tags).toContain("ดิจิทัล");
    expect(result.tags).not.toContain("ประกาศ");
    expect(result.tags).not.toContain("RCAT");
  });

  it("cleans Facebook hashtags", () => {
    expect(extractFacebookHashtags("#RCAT #SmartFarm, #นักศึกษา")).toEqual(["RCAT", "SmartFarm", "นักศึกษา"]);
  });
});
