import { isFacebookUrl } from "./facebookEmbed";

export const FACEBOOK_EMBED_TEMPLATE = "facebook-embed" as const;
export const CONTENT_TEMPLATES = ["standard", "feature", "update", FACEBOOK_EMBED_TEMPLATE] as const;

export type ContentTemplate = (typeof CONTENT_TEMPLATES)[number];

export const CONTENT_TEMPLATE_LABELS: Record<ContentTemplate, string> = {
  standard: "มาตรฐาน",
  feature: "เนื้อหาเด่น",
  update: "อัปเดต",
  "facebook-embed": "Facebook Embed"
};

export function isContentTemplate(value: unknown): value is ContentTemplate {
  return typeof value === "string" && CONTENT_TEMPLATES.includes(value as ContentTemplate);
}

export function resolveContentTemplate(input: {
  template?: string | null;
  canonicalUrl?: string | null;
}): ContentTemplate {
  const template = typeof input.template === "string" ? input.template.trim() : "";

  if (template) {
    return isContentTemplate(template) ? template : "standard";
  }

  return isFacebookUrl(input.canonicalUrl || "") ? "facebook-embed" : "standard";
}
