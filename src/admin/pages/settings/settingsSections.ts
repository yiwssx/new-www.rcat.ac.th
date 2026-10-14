import type { SiteSettings } from "../../../features/cms-settings/types";

import { settingsCategories } from "../../../config/adminSettingsCategories";

export { settingsCategories };

export type SettingsCategory = (typeof settingsCategories)[number];
export type SiteSettingsCategory = Extract<SettingsCategory, "general" | "leadership" | "footer" | "appearance">;

export const siteSettingsKeys: Record<SiteSettingsCategory, readonly (keyof SiteSettings)[]> = {
  general: [
    "siteName",
    "eyebrow",
    "intro",
    "campus",
    "phone",
    "fax",
    "email",
    "address",
    "admissionUrl",
    "facebookUrl",
    "youtubeUrl",
    "tiktokUrl",
    "heroTitle",
    "heroDescription",
    "heroChip",
    "heroImageUrl",
    "mapUrl",
    "mapEmbedUrl"
  ],
  leadership: ["directorName", "directorTitle", "directorDescription", "directorImageUrl", "leadership"],
  footer: [
    "footerTitle",
    "footerDescription",
    "footerDirectoryGroups",
    "messengerUrl",
    "messengerLabel",
    "messengerEnabled"
  ],
  appearance: ["mourningModeEnabled", "mourningRibbonEnabled", "mourningModeLabel", "mourningModeNotice"]
};

export function isSiteSettingsCategory(category: SettingsCategory): category is SiteSettingsCategory {
  return category === "general" || category === "leadership" || category === "footer" || category === "appearance";
}

export const settingsNavigation: ReadonlyArray<{ id: SettingsCategory; label: string; description: string }> = [
  { id: "general", label: "ข้อมูลเว็บไซต์", description: "ข้อมูลสถานศึกษา ช่องทางติดต่อ และภาพหน้าแรก" },
  { id: "homepage", label: "หน้าแรก", description: "Intro Gate ประกาศวิ่ง และวิดีโอ" },
  { id: "leadership", label: "ผู้บริหารสถานศึกษา", description: "ภาพและข้อมูลผู้บริหารที่แสดงบนหน้าแรก" },
  { id: "footer", label: "ส่วนท้ายเว็บไซต์", description: "ลิงก์ส่วนท้ายและ Messenger" },
  { id: "appearance", label: "การแสดงผล", description: "วันที่ เวลา ริบบิ้น และโหมดไว้อาลัย" },
  { id: "visitors", label: "สถิติผู้เข้าชม", description: "ดูสถิติและตั้งค่าการแสดงผล" },
  { id: "access", label: "บทบาทและความปลอดภัย", description: "ตรวจสอบบทบาทและนโยบายความปลอดภัย" }
];

/**
 * Send a partial site-settings payload, never a stale entire record.
 * This preserves edits to other settings pages and refuses to overwrite
 * changes to the same field made since this editor loaded.
 */
export function buildScopedSiteSettingsPatch(
  baseline: SiteSettings,
  edited: SiteSettings,
  latest: SiteSettings,
  category: SiteSettingsCategory
): Partial<SiteSettings> {
  const patch: Record<string, unknown> = {};
  for (const key of siteSettingsKeys[category]) {
    const before = JSON.stringify(baseline[key]);
    const changed = JSON.stringify(edited[key]);
    const remote = JSON.stringify(latest[key]);
    if (before === changed) continue;
    if (remote !== before && remote !== changed) {
      throw new Error("ข้อมูลส่วนนี้ถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดหน้านี้ใหม่ก่อนบันทึก");
    }
    patch[key] = edited[key];
  }
  return patch as Partial<SiteSettings>;
}
