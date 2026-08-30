import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export const FACEBOOK_CONTENT_CATEGORIES = Object.freeze([
  "ข่าวประชาสัมพันธ์",
  "กิจกรรม",
  "อบรม/โครงการ",
  "ประกาศ",
  "ผลงานและรางวัล",
  "จัดซื้อจัดจ้าง",
  "ITA/คุณธรรมและความโปร่งใส"
]);

const CATEGORY_RULES = [
  {
    category: "จัดซื้อจัดจ้าง",
    signals: [
      [12, /จัดซื้อจัดจ้าง|ประกวดราคา|ราคากลาง|e[- ]?bidding|สอบราคา/iu, "procurement-explicit"],
      [12, /ประกาศผู้ชนะการเสนอราคา|ผู้ชนะการเสนอราคา|วิธีเฉพาะเจาะจง/iu, "procurement-award"],
      [7, /จัดซื้อ|จัดจ้าง|เสนอราคา|ใบเสนอราคา/iu, "procurement-keyword"]
    ]
  },
  {
    category: "ITA/คุณธรรมและความโปร่งใส",
    signals: [
      [12, /\bITA\b|\bOIT\b/iu, "ita-acronym"],
      [11, /การประเมินคุณธรรมและความโปร่งใส|เปิดเผยข้อมูลสาธารณะ/iu, "ita-explicit"],
      [8, /ป\.ป\.ช\.?|ต่อต้านการทุจริต|ป้องกันการทุจริต|จริยธรรม/iu, "integrity-keyword"],
      [5, /คุณธรรม|ความโปร่งใส/iu, "integrity-general"]
    ]
  },
  {
    category: "ประกาศ",
    signals: [
      [11, /(?:^|\n)\s*ประกาศ(?:\s|[:：])/iu, "announcement-heading"],
      [10, /รับสมัคร|เปิดรับสมัคร|สมัครเรียน|รับลงทะเบียน/iu, "application"],
      [10, /รายชื่อผู้มีสิทธิ|รายชื่อผู้ผ่าน|ผลการคัดเลือก|ผลการสอบ|ประกาศผล/iu, "result-notice"],
      [8, /กำหนดการ|แจ้งกำหนด|แจ้งให้ทราบ|ประชาสัมพันธ์รับสมัคร/iu, "notice"],
      [5, /ประกาศ|แจ้ง|รายชื่อ/iu, "announcement-general"]
    ]
  },
  {
    category: "ผลงานและรางวัล",
    signals: [
      [12, /ได้รับรางวัล|คว้ารางวัล|รับรางวัล|มอบรางวัล/iu, "award-explicit"],
      [12, /ชนะเลิศ|รองชนะเลิศ|รางวัลชนะเลิศ|รางวัลดีเด่น/iu, "award-placement"],
      [9, /ได้รับคัดเลือก|ผ่านการคัดเลือก.*ระดับ|ผลงานดีเด่น/iu, "achievement"],
      [3, /ผลงาน|รางวัล/iu, "achievement-general"],
      [1, /แข่งขัน|การแข่งขัน|ประกวด/iu, "competition-weak"]
    ]
  },
  {
    category: "อบรม/โครงการ",
    signals: [
      [10, /ฝึกอบรม|การอบรม|อบรมเชิงปฏิบัติการ|ประชุมเชิงปฏิบัติการ/iu, "training-explicit"],
      [8, /สัมมนา|workshop/iu, "seminar"],
      [6, /โครงการอบรม|โครงการพัฒนา|โครงการส่งเสริม|โครงการยกระดับ/iu, "project-explicit"],
      [4, /โครงการ/iu, "project-general"],
      [3, /พัฒนาศักยภาพ|พัฒนาทักษะ|ศึกษาดูงาน/iu, "development"]
    ]
  },
  {
    category: "กิจกรรม",
    signals: [
      [10, /จัดกิจกรรม|กิจกรรมเนื่องใน|กิจกรรมวัน/iu, "activity-explicit"],
      [8, /เข้าร่วมกิจกรรม|ร่วมกิจกรรม/iu, "activity-participation"],
      [8, /พิธีเปิด|พิธีปิด|พิธีถวาย|พิธีทำบุญ|พิธีลงนาม/iu, "ceremony"],
      [7, /ต้อนรับ|ลงพื้นที่|เยี่ยมชม|เยี่ยมบ้าน|จิตอาสา|บริการวิชาชีพ/iu, "activity-action"],
      [5, /ประชุม|เข้าร่วมประชุม|แข่งขัน|การแข่งขัน|ประกวด/iu, "participation"],
      [3, /กิจกรรม|เข้าร่วม|ร่วมกับ/iu, "activity-general"]
    ]
  }
];

const HARD_OVERRIDES = [
  [
    "จัดซื้อจัดจ้าง",
    /จัดซื้อจัดจ้าง|ประกวดราคา|ราคากลาง|e[- ]?bidding|ประกาศผู้ชนะการเสนอราคา|ผู้ชนะการเสนอราคา/iu,
    "hard-procurement"
  ],
  ["ITA/คุณธรรมและความโปร่งใส", /\bITA\b|\bOIT\b|การประเมินคุณธรรมและความโปร่งใส/iu, "hard-ita"],
  ["ผลงานและรางวัล", /ได้รับรางวัล|คว้ารางวัล|ชนะเลิศ|รองชนะเลิศ|รางวัลดีเด่น/iu, "hard-award"]
];

const TAG_RULES = [
  ["รับสมัคร", /รับสมัคร|เปิดรับสมัคร|สมัครเรียน/iu],
  ["สมัครงาน", /รับสมัครงาน|รับสมัคร.*พนักงาน|ลูกจ้างชั่วคราว|พนักงานราชการ/iu],
  ["ฝึกงาน", /ฝึกงาน|ฝึกประสบการณ์วิชาชีพ/iu],
  ["นักเรียน", /นักเรียน/iu],
  ["นักศึกษา", /นักศึกษา/iu],
  ["ครูและบุคลากร", /ครู|บุคลากร|ข้าราชการครู/iu],
  ["ประชุม", /ประชุม/iu],
  ["อบรม", /อบรม|ฝึกอบรม|workshop/iu],
  ["สัมมนา", /สัมมนา/iu],
  ["โครงการ", /โครงการ/iu],
  ["กิจกรรม", /กิจกรรม/iu],
  ["การแข่งขัน", /แข่งขัน|การแข่งขัน/iu],
  ["ประกวด", /ประกวด/iu],
  ["รางวัล", /ได้รับรางวัล|คว้ารางวัล|ชนะเลิศ|รองชนะเลิศ|รับรางวัล/iu],
  ["จัดซื้อจัดจ้าง", /จัดซื้อ|จัดจ้าง|ประกวดราคา|ราคากลาง|เสนอราคา|e[- ]?bidding/iu],
  ["ITA", /\bITA\b|\bOIT\b|คุณธรรมและความโปร่งใส|ป้องกันการทุจริต/iu],
  ["MOU", /\bMOU\b|บันทึกข้อตกลงความร่วมมือ/iu],
  ["ทวิภาคี", /ทวิภาคี/iu],
  ["นวัตกรรม", /นวัตกรรม/iu],
  ["สิ่งประดิษฐ์", /สิ่งประดิษฐ์/iu],
  ["งานวิจัย", /งานวิจัย|วิจัย/iu],
  ["เกษตร", /เกษตร|พืช|สัตว์|ประมง|ฟาร์ม/iu],
  ["อาชีวศึกษา", /อาชีวศึกษา|อาชีวะ/iu],
  ["วันสำคัญ", /วันสำคัญ|วันเฉลิมพระชนมพรรษา|วันชาติ|วันแม่|วันพ่อ/iu],
  ["จิตอาสา", /จิตอาสา/iu]
];

const GENERIC_HASHTAGS = new Set([
  "rcat",
  "ประชาสัมพันธ์",
  "ข่าวประชาสัมพันธ์",
  "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
  "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด101"
]);

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeForMatching(value) {
  return normalizeWhitespace(value).normalize("NFKC");
}

function cleanTag(value) {
  return normalizeWhitespace(value)
    .replace(/^#+/u, "")
    .replace(/[.,;:!?(){}"'“”‘’]+$/gu, "")
    .replace(/^\[+|\]+$/gu, "");
}

function addUniqueTag(tags, seen, value) {
  const tag = cleanTag(value);
  if (!tag) return;

  const key = tag.toLocaleLowerCase("th-TH");
  if (seen.has(key) || GENERIC_HASHTAGS.has(key)) return;

  seen.add(key);
  tags.push(tag);
}

export function extractFacebookHashtags(text) {
  return Array.from(String(text ?? "").matchAll(/#([^\s#]+)/gu), (match) => cleanTag(match[1])).filter(Boolean);
}

function scoreCategories(text) {
  return CATEGORY_RULES.map((rule) => {
    let score = 0;
    const reasons = [];

    for (const [weight, pattern, label] of rule.signals) {
      if (pattern.test(text)) {
        score += weight;
        reasons.push(label);
      }
    }

    return { category: rule.category, score, reasons };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      CATEGORY_RULES.findIndex((rule) => rule.category === a.category) -
      CATEGORY_RULES.findIndex((rule) => rule.category === b.category)
    );
  });
}

function resolveConfidence(top, second) {
  const margin = top.score - (second?.score ?? 0);
  if (top.score >= 10 && margin >= 5) return 0.96;
  if (top.score >= 8 && margin >= 3) return 0.92;
  if (top.score >= 6 && margin >= 2) return 0.86;
  if (top.score >= 4 && margin >= 2) return 0.78;
  if (top.score >= 2) return 0.68;
  return 0.58;
}

function resolveCategory(text) {
  for (const [category, pattern, reason] of HARD_OVERRIDES) {
    if (pattern.test(text)) {
      return { category, confidence: 0.99, reasons: [reason], scores: scoreCategories(text) };
    }
  }

  const scores = scoreCategories(text);
  const [top, second] = scores;

  if (!top || top.score < 2) {
    return {
      category: "ข่าวประชาสัมพันธ์",
      confidence: 0.58,
      reasons: ["fallback-no-strong-category-signal"],
      scores
    };
  }

  return {
    category: top.category,
    confidence: resolveConfidence(top, second),
    reasons: top.reasons,
    scores
  };
}

function createSemanticTags(text, category) {
  const tags = [];
  const seen = new Set();

  for (const [tag, pattern] of TAG_RULES) {
    if (pattern.test(text)) addUniqueTag(tags, seen, tag);
  }

  for (const hashtag of extractFacebookHashtags(text)) {
    addUniqueTag(tags, seen, hashtag);
  }

  const categoryKey = category.toLocaleLowerCase("th-TH");
  return tags.filter((tag) => tag.toLocaleLowerCase("th-TH") !== categoryKey).slice(0, 10);
}

export function classifyFacebookContent(sourceText) {
  const text = normalizeForMatching(sourceText);
  const classification = resolveCategory(text);

  return {
    category: classification.category,
    tags: createSemanticTags(text, classification.category),
    confidence: classification.confidence,
    reasons: classification.reasons,
    scores: classification.scores
  };
}

export function getFacebookSourceText(post) {
  if (typeof post?.message === "string" && post.message.trim()) return post.message.trim();
  if (typeof post?.story === "string" && post.story.trim()) return post.story.trim();
  return "";
}

export function sanitizeFacebookPostId(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function runFacebookClassifierSelfTest() {
  const cases = [
    ["ประกาศรับสมัครนักเรียนเข้าร่วมการแข่งขันทักษะวิชาชีพ", "ประกาศ"],
    ["ประกาศผู้ชนะการเสนอราคา ซื้อวัสดุการเกษตร โดยวิธีเฉพาะเจาะจง", "จัดซื้อจัดจ้าง"],
    ["นักเรียนได้รับรางวัลชนะเลิศการแข่งขันทักษะวิชาชีพ", "ผลงานและรางวัล"],
    ["จัดโครงการฝึกอบรมเชิงปฏิบัติการพัฒนาทักษะดิจิทัล", "อบรม/โครงการ"],
    ["คณะครูและนักเรียนเข้าร่วมกิจกรรมจิตอาสา", "กิจกรรม"],
    ["การประเมินคุณธรรมและความโปร่งใส ITA ประจำปี", "ITA/คุณธรรมและความโปร่งใส"],
    ["วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ขอประชาสัมพันธ์ข่าวสารทั่วไป", "ข่าวประชาสัมพันธ์"]
  ];

  for (const [text, expected] of cases) {
    assert.equal(classifyFacebookContent(text).category, expected, text);
  }

  return cases.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--self-test")) {
  const total = runFacebookClassifierSelfTest();
  console.log(`Facebook classifier self-test passed: ${total} case(s)`);
}
