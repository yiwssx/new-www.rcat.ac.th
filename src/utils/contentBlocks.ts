export const CONTENT_BLOCKS_MARKER = "[[RCAT_BLOCKS_V1]]";

export type ContentBlockType =
  "paragraph" | "heading" | "quote" | "checklist" | "image" | "video" | "pdf" | "facebookPost" | "button" | "divider";

interface ContentBlockBase {
  id: string;
  type: ContentBlockType;
}

export interface ParagraphContentBlock extends ContentBlockBase {
  type: "paragraph";
  text: string;
}

export interface HeadingContentBlock extends ContentBlockBase {
  type: "heading";
  text: string;
  level: 2 | 3 | 4;
}

export interface QuoteContentBlock extends ContentBlockBase {
  type: "quote";
  text: string;
  citation: string;
}

export interface ChecklistContentBlock extends ContentBlockBase {
  type: "checklist";
  items: string[];
}

export interface MediaContentBlock extends ContentBlockBase {
  type: "image" | "video" | "pdf";
  mediaId: string;
  caption: string;
}

export interface FacebookPostContentBlock extends ContentBlockBase {
  type: "facebookPost";
  href: string;
  caption: string;
  showText: boolean;
  width: number;
  height?: number;
}

export interface ButtonContentBlock extends ContentBlockBase {
  type: "button";
  label: string;
  href: string;
  variant: "contained" | "outlined";
}

export interface DividerContentBlock extends ContentBlockBase {
  type: "divider";
}

export type ContentBlock =
  | ParagraphContentBlock
  | HeadingContentBlock
  | QuoteContentBlock
  | ChecklistContentBlock
  | MediaContentBlock
  | FacebookPostContentBlock
  | ButtonContentBlock
  | DividerContentBlock;

interface SerializedContentBlockPayload {
  version: 1;
  blocks: ContentBlock[];
}

function createBlockId() {
  const randomSuffix = Math.random().toString(36).slice(2, 9);
  return `block-${Date.now().toString(36)}-${randomSuffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeBlockType(value: unknown): ContentBlockType | "" {
  if (
    value === "paragraph" ||
    value === "heading" ||
    value === "quote" ||
    value === "checklist" ||
    value === "image" ||
    value === "video" ||
    value === "pdf" ||
    value === "facebookPost" ||
    value === "button" ||
    value === "divider"
  ) {
    return value;
  }

  return "";
}

function normalizeChecklistItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item).trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function normalizeHeadingLevel(value: unknown): 2 | 3 | 4 {
  if (value === 2 || value === 3 || value === 4) {
    return value;
  }

  if (value === "2" || value === "3" || value === "4") {
    return Number(value) as 2 | 3 | 4;
  }

  return 2;
}

function normalizeFacebookPostWidth(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 500;
  }

  return Math.min(750, Math.max(350, Math.round(numeric)));
}

function normalizeFacebookPostHeight(value: unknown): number | undefined {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }

  return Math.round(numeric);
}

export function createContentBlock(type: ContentBlockType): ContentBlock {
  const id = createBlockId();

  if (type === "heading") {
    return { id, type, text: "", level: 2 };
  }

  if (type === "quote") {
    return { id, type, text: "", citation: "" };
  }

  if (type === "checklist") {
    return { id, type, items: [] };
  }

  if (type === "image" || type === "video" || type === "pdf") {
    return { id, type, mediaId: "", caption: "" };
  }

  if (type === "facebookPost") {
    return { id, type, href: "", caption: "", showText: true, width: 500 };
  }

  if (type === "button") {
    return { id, type, label: "", href: "", variant: "contained" };
  }

  if (type === "divider") {
    return { id, type };
  }

  return { id, type: "paragraph", text: "" };
}

function normalizeContentBlock(value: unknown): ContentBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = normalizeBlockType(value.type);
  if (!type) {
    return null;
  }

  const id = normalizeString(value.id).trim() || createBlockId();

  if (type === "paragraph") {
    return {
      id,
      type,
      text: normalizeString(value.text)
    };
  }

  if (type === "heading") {
    return {
      id,
      type,
      text: normalizeString(value.text),
      level: normalizeHeadingLevel(value.level)
    };
  }

  if (type === "quote") {
    return {
      id,
      type,
      text: normalizeString(value.text),
      citation: normalizeString(value.citation)
    };
  }

  if (type === "checklist") {
    return {
      id,
      type,
      items: normalizeChecklistItems(value.items)
    };
  }

  if (type === "image" || type === "video" || type === "pdf") {
    return {
      id,
      type,
      mediaId: normalizeString(value.mediaId).trim(),
      caption: normalizeString(value.caption)
    };
  }

  if (type === "facebookPost") {
    const height = normalizeFacebookPostHeight(value.height);

    return {
      id,
      type,
      href: normalizeString(value.href).trim(),
      caption: normalizeString(value.caption),
      showText: value.showText === true,
      width: normalizeFacebookPostWidth(value.width),
      ...(height ? { height } : {})
    };
  }

  if (type === "button") {
    const variant = value.variant === "outlined" ? "outlined" : "contained";
    return {
      id,
      type,
      label: normalizeString(value.label),
      href: normalizeString(value.href),
      variant
    };
  }

  return {
    id,
    type: "divider"
  };
}

function normalizeContentBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeContentBlock(item)).filter((item): item is ContentBlock => Boolean(item));
}

function isMeaningfulBlock(block: ContentBlock) {
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    return Boolean(block.text.trim());
  }

  if (block.type === "checklist") {
    return block.items.length > 0;
  }

  if (block.type === "image" || block.type === "video" || block.type === "pdf") {
    return Boolean(block.mediaId);
  }

  if (block.type === "facebookPost") {
    return Boolean(block.href.trim());
  }

  if (block.type === "button") {
    return Boolean(block.label.trim() && block.href.trim());
  }

  return true;
}

function plainTextToParagraphBlocks(body: string): ContentBlock[] {
  const segments = body
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return [];
  }

  return segments.map((segment) => ({
    id: createBlockId(),
    type: "paragraph",
    text: segment
  }));
}

export function parseContentBodyToBlocks(body: string | undefined): ContentBlock[] {
  const value = String(body || "").trim();
  if (!value) {
    return [];
  }

  if (!value.startsWith(CONTENT_BLOCKS_MARKER)) {
    return plainTextToParagraphBlocks(value);
  }

  const payload = value.slice(CONTENT_BLOCKS_MARKER.length).trim();
  if (!payload) {
    return [];
  }

  try {
    const parsed = JSON.parse(payload) as SerializedContentBlockPayload;
    return normalizeContentBlocks(parsed?.blocks);
  } catch {
    return plainTextToParagraphBlocks(payload || value);
  }
}

export function serializeContentBlocksToBody(blocks: ContentBlock[]): string {
  const normalizedBlocks = normalizeContentBlocks(blocks).filter(isMeaningfulBlock);

  if (!normalizedBlocks.length) {
    return "";
  }

  const payload: SerializedContentBlockPayload = {
    version: 1,
    blocks: normalizedBlocks
  };

  return `${CONTENT_BLOCKS_MARKER}\n${JSON.stringify(payload)}`;
}

export function extractMediaIdsFromContentBlocks(blocks: ContentBlock[]) {
  const ids = blocks
    .filter(
      (block): block is MediaContentBlock => block.type === "image" || block.type === "video" || block.type === "pdf"
    )
    .map((block) => block.mediaId)
    .filter(Boolean);

  return Array.from(new Set(ids));
}
