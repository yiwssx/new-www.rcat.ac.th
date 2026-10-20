import type { PublicContentCardItem } from "../../types";

// Keep the original announcement feed unfiltered. This predicate is only for
// the additional general-announcements section on the homepage.
const PROCUREMENT_PATTERN = /procurement|tor|จัดซื้อ|จัดจ้าง|ประกวดราคา/i;
const JOB_PATTERN = /job|career|recruit|รับสมัครงาน|พนักงานราชการ|ลูกจ้าง|บุคลากร|ตำแหน่งงาน|จัดหางาน|อาชีพ/i;

export function isGeneralAnnouncement(item: PublicContentCardItem): boolean {
  if (item.type !== "announcement") return false;
  const searchable = [item.title, item.summary, item.category, ...(item.tags ?? [])].join(" ");
  return !PROCUREMENT_PATTERN.test(searchable) && !JOB_PATTERN.test(searchable);
}
