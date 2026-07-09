import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FALLBACK_TITLE = "ข่าวประชาสัมพันธ์จากวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด";
const FALLBACK_SUMMARY = "ข่าวประชาสัมพันธ์จากวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด เผยแพร่จากเพจ Facebook อย่างเป็นทางการ";
const SOURCE_LABEL = "ที่มา: Facebook วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด";
const DEFAULT_STATUS = "published";
const DEFAULT_CREATED_BY = "facebook-import";
const DEFAULT_OWNER = "facebook-import";
const BODY_CHARACTERS_PER_MINUTE = 1000;

const CONTENT_COLUMNS = [
  "id",
  "slug",
  "type",
  "status",
  "title",
  "summary",
  "body_snapshot",
  "category",
  "tags_json",
  "seo_title",
  "seo_description",
  "canonical_url",
  "featured",
  "reading_minutes",
  "template",
  "body_doc_id",
  "body_doc_url",
  "featured_media_id",
  "media_ids_json",
  "view_count",
  "last_viewed_at",
  "updated_at",
  "publish_at",
  "owner",
  "created_at",
  "deleted_at",
  "created_by",
  "updated_by",
  "revision"
];

const CATEGORY_RULES = [
  {
    category: "จัดซื้อจัดจ้าง",
    patterns: [/จัดซื้อ/u, /จัดจ้าง/u, /จัดซื้อจัดจ้าง/u, /ประกวดราคา/u, /ราคากลาง/u, /e-bidding/iu]
  },
  {
    category: "ITA/คุณธรรมและความโปร่งใส",
    patterns: [/\bITA\b/iu, /คุณธรรม/u, /โปร่งใส/u, /ป\.ป\.ช/u, /จริยธรรม/u]
  },
  {
    category: "ผลงานและรางวัล",
    patterns: [/รางวัล/u, /ชนะเลิศ/u, /รองชนะเลิศ/u, /ผลงาน/u, /แข่งขัน/u, /ประกวด/u]
  },
  {
    category: "อบรม/โครงการ",
    patterns: [/อบรม/u, /ฝึกอบรม/u, /โครงการ/u, /สัมมนา/u, /พัฒนา/u]
  },
  {
    category: "กิจกรรม",
    patterns: [/กิจกรรม/u, /เข้าร่วม/u, /จัดกิจกรรม/u, /พิธี/u, /วันสำคัญ/u, /ต้อนรับ/u]
  },
  {
    category: "ประกาศ",
    patterns: [/ประกาศ/u, /รับสมัคร/u, /แจ้ง/u, /กำหนดการ/u, /รายชื่อ/u]
  }
];

const KEYWORD_TAGS = [
  ["รับสมัคร", /รับสมัคร/u],
  ["ประกาศ", /ประกาศ/u],
  ["กิจกรรม", /กิจกรรม/u],
  ["จัดซื้อจัดจ้าง", /จัดซื้อ|จัดจ้าง|ประกวดราคา/u],
  ["รางวัล", /รางวัล|ชนะเลิศ|ผลงาน/u],
  ["อบรม", /อบรม|โครงการ|สัมมนา/u],
  ["ITA", /\bITA\b|คุณธรรม|โปร่งใส/iu]
];

function parseCliArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function assertStatus(value) {
  if (value !== "published" && value !== "draft") {
    throw new Error("--status must be published or draft");
  }
}

function normalizeGeneratedAt(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim() !== "") {
    const timestamp = Date.parse(value);

    if (Number.isFinite(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeFacebookTimestamp(value, fallback) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function sanitizePostId(value) {
  const sanitized = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (!sanitized) {
    throw new Error("Facebook post id is required");
  }

  return sanitized;
}

function getPostText(post) {
  return typeof post.message === "string" && post.message.trim() !== ""
    ? post.message
    : typeof post.story === "string"
      ? post.story
      : "";
}

function stripUrls(value) {
  return value.replace(/https?:\/\/\S+|www\.\S+/giu, " ");
}

function stripHashtags(value) {
  return value.replace(/#[^\s#]+/gu, " ");
}

function stripDecorativeEmoji(value) {
  return value.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function meaningfulCharacterCount(value) {
  return Array.from(value.matchAll(/[\p{L}\p{N}]/gu)).length;
}

function isUrlOnly(value) {
  return /^(?:https?:\/\/\S+|www\.\S+)$/iu.test(value.trim());
}

function cleanTextForTitle(value) {
  return normalizeWhitespace(stripDecorativeEmoji(stripHashtags(stripUrls(value))));
}

function limitText(value, maxLength) {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  const clipped = characters.slice(0, maxLength).join("");
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace >= Math.floor(maxLength * 0.65) ? clipped.slice(0, lastSpace) : clipped;

  return `${safeClip.replace(/[,\s.]+$/u, "")}...`;
}

function createTitle(postText) {
  const line = postText
    .split(/\r?\n/u)
    .map((entry) => cleanTextForTitle(entry))
    .find((entry) => entry && !isUrlOnly(entry) && meaningfulCharacterCount(entry) >= 8);

  if (!line) {
    return FALLBACK_TITLE;
  }

  return limitText(line, 110) || FALLBACK_TITLE;
}

function createSummary(postText) {
  const cleaned = normalizeWhitespace(stripHashtags(stripUrls(postText)));

  if (meaningfulCharacterCount(cleaned) < 20) {
    return FALLBACK_SUMMARY;
  }

  return limitText(cleaned, 210);
}

function classifyCategory(postText) {
  const normalizedText = postText.trim();

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedText))) {
      return rule.category;
    }
  }

  return "ข่าวประชาสัมพันธ์";
}

function extractHashtags(postText) {
  return Array.from(postText.matchAll(/#([^\s#]+)/gu), (match) => match[1].replace(/[.,;:!?()[\]{}"'“”‘’]+$/gu, ""))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createTagsJson(postText, category) {
  const tags = new Set();

  extractHashtags(postText).forEach((tag) => tags.add(tag));
  tags.add(category);

  KEYWORD_TAGS.forEach(([tag, pattern]) => {
    if (pattern.test(postText)) {
      tags.add(tag);
    }
  });

  return JSON.stringify(Array.from(tags).slice(0, 12));
}

function createBodySnapshot(postText, sourceUrl) {
  const sourceBlock = sourceUrl ? `${SOURCE_LABEL}\n${sourceUrl}` : SOURCE_LABEL;
  const bodyText = postText.trim();

  return bodyText ? `${bodyText}\n\n${sourceBlock}` : sourceBlock;
}

function estimateReadingMinutes(body) {
  return Math.max(1, Math.ceil(Array.from(body).length / BODY_CHARACTERS_PER_MINUTE));
}

function hasPostImage(post) {
  if (typeof post.full_picture === "string" && post.full_picture.trim() !== "") {
    return true;
  }

  const attachments = post.attachments?.data;

  if (!Array.isArray(attachments)) {
    return false;
  }

  return attachments.some((attachment) => {
    if (attachment?.media?.image?.src || attachment?.media?.source) {
      return true;
    }

    const subattachments = attachment?.subattachments?.data;

    return Array.isArray(subattachments) && subattachments.some((subattachment) => subattachment?.media?.image?.src);
  });
}

function warningForPost(post) {
  const warnings = [];
  const postText = getPostText(post);

  if (meaningfulCharacterCount(cleanTextForTitle(postText)) < 8) {
    warnings.push("short_or_missing_message");
  }

  if (typeof post.permalink_url !== "string" || post.permalink_url.trim() === "") {
    warnings.push("missing_permalink_url");
  }

  if (typeof post.created_time !== "string" || post.created_time.trim() === "") {
    warnings.push("missing_created_time");
  }

  return warnings.join("|");
}

export function transformFacebookPostToContentRow(post, options = {}) {
  const generatedAt = normalizeGeneratedAt(options.generatedAt);
  const status = options.status ?? DEFAULT_STATUS;
  const createdBy = options.createdBy ?? DEFAULT_CREATED_BY;

  assertStatus(status);

  const sourceId = requireString(post?.id, "Facebook post id");
  const sanitizedPostId = sanitizePostId(sourceId);
  const postText = getPostText(post);
  const sourceUrl = typeof post.permalink_url === "string" ? post.permalink_url.trim() : "";
  const publishAt = normalizeFacebookTimestamp(post.created_time, generatedAt);
  const title = createTitle(postText);
  const summary = createSummary(postText);
  const bodySnapshot = createBodySnapshot(postText, sourceUrl);
  const category = classifyCategory(postText);

  return {
    id: `facebook-post-${sanitizedPostId}`,
    slug: `facebook-${sanitizedPostId}`,
    type: "news",
    status,
    title,
    summary,
    body_snapshot: bodySnapshot,
    category,
    tags_json: createTagsJson(postText, category),
    seo_title: title,
    seo_description: summary,
    canonical_url: "",
    featured: 0,
    reading_minutes: estimateReadingMinutes(bodySnapshot),
    template: "article",
    body_doc_id: "",
    body_doc_url: "",
    featured_media_id: "",
    media_ids_json: "[]",
    view_count: 0,
    last_viewed_at: "",
    updated_at: generatedAt,
    publish_at: publishAt,
    owner: DEFAULT_OWNER,
    created_at: publishAt,
    deleted_at: "",
    created_by: createdBy,
    updated_by: createdBy,
    revision: 1
  };
}

export function transformFacebookPostsToContentRows(rawExport, options = {}) {
  if (!rawExport || !Array.isArray(rawExport.posts)) {
    throw new Error("Input JSON must contain a posts array");
  }

  const generatedAt = normalizeGeneratedAt(options.generatedAt ?? rawExport.generatedAt);

  return rawExport.posts.map((post) =>
    transformFacebookPostToContentRow(post, {
      ...options,
      generatedAt,
      pageId: options.pageId ?? rawExport.pageId
    })
  );
}

function toSqlLiteral(value) {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot serialize non-finite number to SQL");
    }

    return String(value);
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function createSqlCommentValue(value) {
  return String(value ?? "")
    .replace(/\r?\n/gu, " ")
    .trim();
}

export function createFacebookPostsSql(rawExport, options = {}) {
  const generatedAt = normalizeGeneratedAt(options.generatedAt ?? rawExport?.generatedAt);
  const rows = transformFacebookPostsToContentRows(rawExport, { ...options, generatedAt });
  const sourcePageId = createSqlCommentValue(rawExport.pageId ?? options.pageId ?? "");
  const since = createSqlCommentValue(rawExport.since ?? "");
  const until = createSqlCommentValue(rawExport.until ?? "");
  const header = [
    `-- source page id: ${sourcePageId}`,
    `-- date range: ${since} to ${until}`,
    `-- generated at: ${generatedAt}`,
    `-- total rows: ${rows.length}`,
    ""
  ];
  const statements = ["BEGIN TRANSACTION;"];

  if (rows.length > 0) {
    statements.push(
      `INSERT OR IGNORE INTO contents (${CONTENT_COLUMNS.join(", ")}) VALUES`,
      `${rows
        .map((row) => `  (${CONTENT_COLUMNS.map((column) => toSqlLiteral(row[column])).join(", ")})`)
        .join(",\n")};`
    );
  }

  statements.push("COMMIT;", "");

  return [...header, ...statements].join("\n");
}

function csvValue(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/u.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function createFacebookImportReportCsv(rawExport, rows = transformFacebookPostsToContentRows(rawExport)) {
  const rowBySourceId = new Map(rows.map((row) => [row.id.replace(/^facebook-post-/u, ""), row]));
  const lines = ["source_id,publish_at,title,category,status,slug,source_url,has_message,has_image,warning"];

  rawExport.posts.forEach((post) => {
    const sanitizedPostId = sanitizePostId(post.id);
    const row = rowBySourceId.get(sanitizedPostId);
    const postText = getPostText(post);

    lines.push(
      [
        post.id,
        row?.publish_at ?? normalizeFacebookTimestamp(post.created_time, ""),
        row?.title ?? "",
        row?.category ?? "",
        row?.status ?? "",
        row?.slug ?? "",
        post.permalink_url ?? "",
        postText.trim() ? "yes" : "no",
        hasPostImage(post) ? "yes" : "no",
        warningForPost(post)
      ]
        .map(csvValue)
        .join(",")
    );
  });

  return `${lines.join("\n")}\n`;
}

async function readJson(inputPath) {
  return JSON.parse(await readFile(inputPath, "utf8"));
}

async function writeTextFile(outputPath, content) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
}

function defaultReportPath(outputPath) {
  const parsed = path.parse(outputPath);

  return path.join(parsed.dir, `${parsed.name}.report.csv`);
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
  const inputPath = requireString(args.input, "--input");
  const outputPath = requireString(args.output, "--output");
  const status = args.status ?? DEFAULT_STATUS;
  const createdBy = args["created-by"] ?? DEFAULT_CREATED_BY;
  const reportOutputPath = args["report-output"] ?? defaultReportPath(outputPath);

  assertStatus(status);

  const rawExport = await readJson(inputPath);
  const generatedAt = new Date().toISOString();
  const rows = transformFacebookPostsToContentRows(rawExport, { generatedAt, status, createdBy });

  await writeTextFile(outputPath, createFacebookPostsSql(rawExport, { generatedAt, status, createdBy }));
  await writeTextFile(reportOutputPath, createFacebookImportReportCsv(rawExport, rows));

  console.log(`Generated ${rows.length} SQL row(s): ${outputPath}`);
  console.log(`Generated import report: ${reportOutputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
