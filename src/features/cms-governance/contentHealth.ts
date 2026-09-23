import type { MediaAsset } from "../cms-media/types";
import type { ContentItem } from "../public-content/types";
import { parseContentBodyToBlocks, type RichTextNode } from "../../utils/contentBlocks";

export type ContentHealthIssueCode =
  | "missing-summary"
  | "missing-body"
  | "missing-owner"
  | "missing-seo"
  | "missing-media"
  | "missing-image-alt"
  | "stale-editorial-item";

export interface ContentHealthIssue {
  code: ContentHealthIssueCode;
  contentId: string;
  title: string;
  detail: string;
}

export interface ContentHealthReport {
  totalContent: number;
  healthyContent: number;
  issueCount: number;
  issueCounts: Record<ContentHealthIssueCode, number>;
  issues: ContentHealthIssue[];
}

const STALE_EDITORIAL_DAYS = 30;

function richTextHasMeaningfulContent(node: RichTextNode): boolean {
  if (node.type === "text" && Boolean(node.text?.trim())) return true;
  if (node.type === "horizontalRule") return true;
  return node.content?.some(richTextHasMeaningfulContent) ?? false;
}

function hasMeaningfulBody(body: string | undefined) {
  if (!body?.trim()) return false;
  const blocks = parseContentBodyToBlocks(body);
  if (!blocks.length) return false;

  return blocks.some((block) => {
    if (block.type === "richText") return richTextHasMeaningfulContent(block.document);
    if (block.type === "paragraph" || block.type === "heading") return Boolean(block.text.trim());
    if (block.type === "quote") return Boolean(block.text.trim() || block.citation.trim());
    if (block.type === "checklist") return block.items.some((item) => Boolean(item.trim()));
    if (block.type === "image" || block.type === "video" || block.type === "pdf") return Boolean(block.mediaId.trim());
    if (block.type === "facebookPost") return Boolean(block.href.trim());
    if (block.type === "link") return Boolean(block.label.trim() || block.href.trim() || block.mediaId.trim());
    if (block.type === "button") return Boolean(block.label.trim() || block.href.trim());
    return block.type === "divider";
  });
}

function referencedMediaIds(item: ContentItem) {
  return [
    ...new Set([item.featuredMediaId, ...(item.mediaIds ?? [])].map((id) => String(id || "").trim()).filter(Boolean))
  ];
}

function isStaleEditorialItem(item: ContentItem, now: Date) {
  if (item.status !== "draft" && item.status !== "review") return false;
  const updatedAt = Date.parse(item.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  return now.getTime() - updatedAt > STALE_EDITORIAL_DAYS * 24 * 60 * 60 * 1000;
}

function emptyIssueCounts(): Record<ContentHealthIssueCode, number> {
  return {
    "missing-summary": 0,
    "missing-body": 0,
    "missing-owner": 0,
    "missing-seo": 0,
    "missing-media": 0,
    "missing-image-alt": 0,
    "stale-editorial-item": 0
  };
}

export function evaluateContentHealth(
  content: ContentItem[],
  media: MediaAsset[],
  now = new Date()
): ContentHealthReport {
  const issues: ContentHealthIssue[] = [];
  const issueCounts = emptyIssueCounts();
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const unhealthyContentIds = new Set<string>();

  function addIssue(item: ContentItem, code: ContentHealthIssueCode, detail: string) {
    issues.push({ code, contentId: item.id, title: item.title || "ไม่มีชื่อเรื่อง", detail });
    issueCounts[code] += 1;
    unhealthyContentIds.add(item.id);
  }

  for (const item of content) {
    if (!item.summary.trim()) addIssue(item, "missing-summary", "ยังไม่มีคำโปรย/สรุปเนื้อหา");
    if (!hasMeaningfulBody(item.body)) addIssue(item, "missing-body", "เนื้อหาหลักยังว่าง");
    if (!item.owner.trim()) addIssue(item, "missing-owner", "ยังไม่ได้ระบุผู้รับผิดชอบ");

    if (
      (item.status === "published" || item.status === "scheduled") &&
      (!item.seoTitle?.trim() || !item.seoDescription?.trim())
    ) {
      addIssue(item, "missing-seo", "เนื้อหาที่เผยแพร่/ตั้งเวลาแล้วยังมี SEO title หรือ description ไม่ครบ");
    }

    if (isStaleEditorialItem(item, now)) {
      addIssue(item, "stale-editorial-item", `ฉบับร่าง/ตรวจทานไม่มีการแก้ไขเกิน ${STALE_EDITORIAL_DAYS} วัน`);
    }

    for (const mediaId of referencedMediaIds(item)) {
      const asset = mediaById.get(mediaId);
      if (!asset) {
        addIssue(item, "missing-media", `อ้างอิงสื่อที่ไม่พบในคลัง: ${mediaId}`);
        continue;
      }
      if (asset.type === "image" && !asset.altText?.trim()) {
        addIssue(item, "missing-image-alt", `รูปภาพ “${asset.name}” ยังไม่มี alt text`);
      }
    }
  }

  return {
    totalContent: content.length,
    healthyContent: Math.max(0, content.length - unhealthyContentIds.size),
    issueCount: issues.length,
    issueCounts,
    issues
  };
}
