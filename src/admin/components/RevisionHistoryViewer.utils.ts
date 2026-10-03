import type { ContentRevision } from "../../features/cms-governance/client";
import { formatDisplayDate } from "../../utils/dateDisplay";

export function revisionActionLabel(reason: string) {
  const labels: Record<string, string> = {
    create: "สร้าง",
    update: "แก้ไข",
    publish: "เผยแพร่",
    unpublish: "ยกเลิกเผยแพร่",
    delete: "ลบ",
    restore: "กู้คืน"
  };
  return labels[reason] || reason || "ไม่ระบุ";
}

export function snapshotSummaryRows(revision: ContentRevision) {
  const snapshot = revision.snapshot;
  if (!snapshot) return [];
  return [
    ["ชื่อเรื่อง", snapshot.title || "—"],
    ["Slug", snapshot.slug || "—"],
    ["ประเภท", snapshot.type || "—"],
    ["สถานะ", snapshot.status || "—"],
    ["ผู้รับผิดชอบ", snapshot.owner || "—"],
    ["หมวดหมู่", snapshot.category || "—"],
    ["กำหนดเผยแพร่", snapshot.publishAt ? formatDisplayDate(snapshot.publishAt) : "—"],
    ["กำหนดสิ้นสุด", snapshot.unpublishAt ? formatDisplayDate(snapshot.unpublishAt) : "—"]
  ] as const;
}
