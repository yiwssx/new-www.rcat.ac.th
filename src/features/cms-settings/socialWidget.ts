/** Public-facing, backwards-compatible CMS configuration for the homepage social block. */
export const SOCIAL_ICON_KEYS = [
  "facebook",
  "school",
  "computer",
  "business",
  "campaign",
  "groups",
  "calendar",
  "public",
  "work",
  "link",
  "custom"
] as const;

export type SocialIconKey = (typeof SOCIAL_ICON_KEYS)[number];
export type SocialLinkCategory = "department" | "unit";

export interface HomepageSocialLink {
  id: string;
  category: SocialLinkCategory;
  label: string;
  href: string;
  iconKey: SocialIconKey;
  iconUrl: string;
  enabled: boolean;
}

export interface HomepageSocialWidgetSettings {
  enabled: boolean;
  pageEmbedEnabled: boolean;
  pageEmbedHeight: number;
  links: HomepageSocialLink[];
}

export const DEFAULT_SOCIAL_WIDGET: HomepageSocialWidgetSettings = {
  enabled: false,
  pageEmbedEnabled: true,
  pageEmbedHeight: 520,
  links: []
};

export const SOCIAL_ICON_OPTIONS: ReadonlyArray<{ value: SocialIconKey; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "school", label: "สถานศึกษา" },
  { value: "computer", label: "คอมพิวเตอร์" },
  { value: "business", label: "บริหารธุรกิจ" },
  { value: "campaign", label: "ประชาสัมพันธ์" },
  { value: "groups", label: "บุคลากร" },
  { value: "calendar", label: "กิจกรรม" },
  { value: "public", label: "เว็บไซต์" },
  { value: "work", label: "หน่วยงาน" },
  { value: "link", label: "ลิงก์ทั่วไป" },
  { value: "custom", label: "อัปโหลดโลโก้เอง" }
];

const iconSet: ReadonlySet<string> = new Set(SOCIAL_ICON_KEYS);
const facebookHosts = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function socialHttpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (
    !input ||
    input.includes("\\") ||
    /\s/.test(input) ||
    [...input].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    return "";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function socialFacebookPageUrl(value: unknown): string {
  const href = socialHttpsUrl(value);
  if (!href) return "";
  const url = new URL(href);
  return facebookHosts.has(url.hostname.toLowerCase()) && url.pathname !== "/" && !url.pathname.startsWith("/plugins/")
    ? href
    : "";
}

export function normalizeHomepageSocialWidget(value: unknown): HomepageSocialWidgetSettings {
  const source = record(value);
  const height = Number(source.pageEmbedHeight);
  const links = Array.isArray(source.links) ? source.links.slice(0, 100) : [];
  return {
    enabled: source.enabled === true,
    pageEmbedEnabled: source.pageEmbedEnabled !== false,
    pageEmbedHeight: Number.isFinite(height) ? Math.round(Math.min(800, Math.max(300, height))) : 520,
    links: links.map((value): HomepageSocialLink => {
      const item = record(value);
      const iconKey =
        typeof item.iconKey === "string" && iconSet.has(item.iconKey) ? (item.iconKey as SocialIconKey) : "facebook";
      const iconUrl = socialHttpsUrl(item.iconUrl);
      return {
        id: String(item.id ?? "").slice(0, 96),
        category: item.category === "unit" ? "unit" : "department",
        label: String(item.label ?? "")
          .trim()
          .slice(0, 120),
        href: socialHttpsUrl(item.href),
        iconKey: iconKey === "custom" && !iconUrl ? "link" : iconKey,
        iconUrl,
        enabled: item.enabled === true
      };
    })
  };
}

export function validateHomepageSocialDraft(value: HomepageSocialWidgetSettings) {
  if (value.links.length > 100) throw new Error("ลิงก์ต้องไม่เกิน 100 รายการ");
  const ids = new Set<string>();
  for (const [index, item] of value.links.entries()) {
    if (!item.id || ids.has(item.id)) throw new Error(`รหัสลิงก์รายการที่ ${index + 1} ไม่ถูกต้องหรือซ้ำกัน`);
    ids.add(item.id);
    if (!item.label.trim() || item.label.length > 120) throw new Error(`กรุณาระบุชื่อลิงก์รายการที่ ${index + 1}`);
    if (!socialHttpsUrl(item.href)) throw new Error(`ลิงก์รายการที่ ${index + 1} ต้องเป็น HTTPS URL ที่ถูกต้อง`);
    if (!iconSet.has(item.iconKey)) throw new Error(`ไอคอนรายการที่ ${index + 1} ไม่ถูกต้อง`);
    if (item.iconKey === "custom" && !socialHttpsUrl(item.iconUrl))
      throw new Error(`กรุณาอัปโหลดโลโก้รายการที่ ${index + 1}`);
  }
}
