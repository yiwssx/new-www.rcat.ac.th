import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FacebookIcon from "@mui/icons-material/Facebook";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SocialLinkIcon from "../../../shared/components/SocialLinkIcon";
import {
  normalizeHomepageSocialWidget,
  socialFacebookPageUrl,
  type HomepageSocialWidgetSettings
} from "../../../features/cms-settings/socialWidget";

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

function FacebookPageEmbed({ href, height }: { href: string; height: number }) {
  const frameContainerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const element = frameContainerRef.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(1, Math.floor(element.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const url = width >= 180 ? buildFacebookPagePluginUrl(href, width, height) : "";
  return (
    <Box ref={frameContainerRef} sx={{ width: "100%", minWidth: 0, textAlign: "center" }}>
      {url ? (
        <Box
          component="iframe"
          title="Facebook เพจวิทยาลัย"
          src={url}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; web-share"
          sx={{ display: "block", mx: "auto", border: 0, width: "100%", maxWidth: 500, height }}
        />
      ) : null}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        หากไม่เห็นเนื้อหา Facebook อาจถูกจำกัดโดยเบราว์เซอร์ กรุณาเปิดเพจจากลิงก์ด้านล่าง
      </Typography>
    </Box>
  );
}

export default function HomeSocialLinksCard({
  pageUrl,
  settings
}: {
  pageUrl: string;
  settings?: HomepageSocialWidgetSettings;
}) {
  const widget = normalizeHomepageSocialWidget(settings);
  if (!widget.enabled) return null;
  const facebookHref = socialFacebookPageUrl(pageUrl);
  const links = widget.links.filter(
    (item) => item.enabled && item.label && item.href && (item.iconKey !== "custom" || item.iconUrl)
  );
  if ((!widget.pageEmbedEnabled || !facebookHref) && links.length === 0) return null;

  return (
    <Card
      component="section"
      aria-label="ช่องทาง Facebook และหน่วยงาน"
      data-home-social-widget="true"
      sx={{ width: "100%", minWidth: 0 }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2}>
          {widget.pageEmbedEnabled && facebookHref && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <FacebookIcon color="primary" />
                <Typography variant="h3">Facebook วิทยาลัย</Typography>
              </Stack>
              <FacebookPageEmbed href={facebookHref} height={widget.pageEmbedHeight} />
              <Link
                href={facebookHref}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: "inline-flex", gap: 0.5, alignItems: "center", mt: 1.5 }}
              >
                เปิด Facebook วิทยาลัย <OpenInNewIcon sx={{ fontSize: 16 }} />
              </Link>
            </Box>
          )}
          {(["department", "unit"] as const).map((category) => {
            const group = links.filter((item) => item.category === category);
            if (!group.length) return null;
            return (
              <Box key={category}>
                <Typography variant="h3" sx={{ mb: 1.5 }}>
                  {category === "department" ? "Facebook แผนกวิชา" : "Facebook งานและหน่วยงาน"}
                </Typography>
                <Stack spacing={0} divider={<Divider flexItem />}>
                  {group.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{
                        py: 1.2,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        overflowWrap: "anywhere",
                        minWidth: 0
                      }}
                    >
                      <SocialLinkIcon iconKey={item.iconKey} iconUrl={item.iconUrl} label={item.label} />
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                        {item.label}
                      </Typography>
                      <OpenInNewIcon aria-hidden="true" color="action" sx={{ fontSize: 17 }} />
                    </Link>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
