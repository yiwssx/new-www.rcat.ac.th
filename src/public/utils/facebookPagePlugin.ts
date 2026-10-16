import { socialFacebookPageUrl } from "../../features/cms-settings/socialWidget";

/**
 * Meta Page Plugin supports an empty tabs parameter for a header-only Page card.
 * Keep the embed short so failed/unsupported Timeline content never leaves a large blank panel.
 */
export const FACEBOOK_PAGE_HEADER_HEIGHT = 150;

export function buildFacebookPagePluginUrl(value: string, width: number): string {
  const href = socialFacebookPageUrl(value);
  if (!href) return "";
  const plugin = new URL("https://www.facebook.com/plugins/page.php");
  plugin.searchParams.set("href", href);
  plugin.searchParams.set("tabs", "");
  plugin.searchParams.set("width", String(Math.max(180, Math.min(500, Math.round(width)))));
  plugin.searchParams.set("height", String(FACEBOOK_PAGE_HEADER_HEIGHT));
  plugin.searchParams.set("small_header", "false");
  plugin.searchParams.set("adapt_container_width", "true");
  plugin.searchParams.set("hide_cover", "false");
  plugin.searchParams.set("show_facepile", "false");
  plugin.searchParams.set("hide_cta", "false");
  return plugin.href;
}
