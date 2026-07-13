import type { ContentItem } from "../types";
import { isFacebookUrl } from "./facebookEmbed";
import { CONTENT_TEMPLATE_LABELS, FACEBOOK_EMBED_TEMPLATE, resolveContentTemplate } from "./contentTemplate";

export { FACEBOOK_EMBED_TEMPLATE };
export const FACEBOOK_EMBED_LABEL = CONTENT_TEMPLATE_LABELS[FACEBOOK_EMBED_TEMPLATE];

export function isFacebookContentUrl(value: string | undefined): boolean {
  return isFacebookUrl(value || "");
}

export function isFacebookEmbedContent(item: Pick<ContentItem, "template" | "canonicalUrl"> | null | undefined) {
  return Boolean(item && resolveContentTemplate(item) === FACEBOOK_EMBED_TEMPLATE);
}
