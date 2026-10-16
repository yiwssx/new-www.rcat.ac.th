import { socialFacebookPageUrl } from "../../features/cms-settings/socialWidget";

export function buildFacebookPagePluginUrl(value: string, width: number, height: number): string {
  const href = socialFacebookPageUrl(value);
  if (!href) return "";
  const plugin = new URL("https://www.facebook.com/plugins/page.php");
  plugin.searchParams.set("href", href);
  plugin.searchParams.set("tabs", "timeline");
  plugin.searchParams.set("width", String(Math.max(180, Math.min(500, Math.round(width)))));
  plugin.searchParams.set("height", String(Math.max(300, Math.min(800, Math.round(height)))));
  plugin.searchParams.set("small_header", "false");
  plugin.searchParams.set("adapt_container_width", "true");
  plugin.searchParams.set("hide_cover", "false");
  plugin.searchParams.set("show_facepile", "false");
  return plugin.href;
}
