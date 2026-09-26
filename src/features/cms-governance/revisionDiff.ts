import type { ContentItem } from "../public-content/types";

export interface RevisionFieldChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface RevisionLineChange {
  type: "context" | "removed" | "added";
  text: string;
}

const FIELD_DEFINITIONS: Array<{
  key: keyof ContentItem;
  label: string;
  format?: (value: unknown) => string;
}> = [
  { key: "title", label: "ชื่อเรื่อง" },
  { key: "slug", label: "Slug" },
  { key: "type", label: "ประเภท" },
  { key: "status", label: "สถานะ" },
  { key: "owner", label: "เจ้าของเนื้อหา" },
  { key: "summary", label: "สรุป" },
  { key: "category", label: "หมวดหมู่" },
  { key: "tags", label: "แท็ก", format: (value) => (Array.isArray(value) ? value.join(", ") : "") },
  { key: "seoTitle", label: "SEO title" },
  { key: "seoDescription", label: "SEO description" },
  { key: "canonicalUrl", label: "Canonical URL" },
  { key: "template", label: "Template" },
  { key: "featuredMediaId", label: "Featured media" },
  { key: "mediaIds", label: "Media references", format: (value) => (Array.isArray(value) ? value.join(", ") : "") },
  { key: "publishAt", label: "วันเผยแพร่" },
  { key: "unpublishAt", label: "วันสิ้นสุดการเผยแพร่" }
];

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function compareRevisionFields(before: ContentItem | null, after: ContentItem | null): RevisionFieldChange[] {
  if (!before || !after) return [];
  return FIELD_DEFINITIONS.flatMap(({ key, label, format }) => {
    const beforeValue = format ? format(before[key]) : text(before[key]);
    const afterValue = format ? format(after[key]) : text(after[key]);
    return beforeValue === afterValue ? [] : [{ key: String(key), label, before: beforeValue, after: afterValue }];
  });
}

function fallbackLineDiff(beforeLines: string[], afterLines: string[]): RevisionLineChange[] {
  return [
    ...beforeLines.map((line) => ({ type: "removed" as const, text: line })),
    ...afterLines.map((line) => ({ type: "added" as const, text: line }))
  ];
}

export function compareRevisionBody(beforeBody: string | undefined, afterBody: string | undefined): RevisionLineChange[] {
  const beforeLines = String(beforeBody || "").split("\n");
  const afterLines = String(afterBody || "").split("\n");
  if (beforeLines.join("\n") === afterLines.join("\n")) return [];

  // Cap the quadratic LCS matrix. Long block payloads still receive a safe
  // removed/added view instead of freezing the CMS UI.
  if (beforeLines.length * afterLines.length > 40_000) {
    return fallbackLineDiff(beforeLines, afterLines);
  }

  const matrix = Array.from({ length: beforeLines.length + 1 }, () => new Uint16Array(afterLines.length + 1));
  for (let left = beforeLines.length - 1; left >= 0; left -= 1) {
    for (let right = afterLines.length - 1; right >= 0; right -= 1) {
      matrix[left][right] =
        beforeLines[left] === afterLines[right]
          ? matrix[left + 1][right + 1] + 1
          : Math.max(matrix[left + 1][right], matrix[left][right + 1]);
    }
  }

  const changes: RevisionLineChange[] = [];
  let left = 0;
  let right = 0;
  while (left < beforeLines.length && right < afterLines.length) {
    if (beforeLines[left] === afterLines[right]) {
      changes.push({ type: "context", text: beforeLines[left] });
      left += 1;
      right += 1;
    } else if (matrix[left + 1][right] >= matrix[left][right + 1]) {
      changes.push({ type: "removed", text: beforeLines[left] });
      left += 1;
    } else {
      changes.push({ type: "added", text: afterLines[right] });
      right += 1;
    }
  }
  while (left < beforeLines.length) changes.push({ type: "removed", text: beforeLines[left++] });
  while (right < afterLines.length) changes.push({ type: "added", text: afterLines[right++] });
  return changes;
}
