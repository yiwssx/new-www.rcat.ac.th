import type { ContentItem } from "../types";
import { isFacebookUrl } from "./facebookEmbed";

export const FACEBOOK_EMBED_TEMPLATE = "facebook-embed";
export const FACEBOOK_EMBED_LABEL = "Facebook Embed";

export function isFacebookContentUrl(value: string | undefined): boolean {
  return isFacebookUrl(value || "");
}

export function isFacebookEmbedContent(item: Pick<ContentItem, "template" | "canonicalUrl"> | null | undefined) {
  return Boolean(item?.template === FACEBOOK_EMBED_TEMPLATE || isFacebookContentUrl(item?.canonicalUrl));
}
