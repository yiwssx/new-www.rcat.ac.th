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
import PublicDeferredEmbed from "../../../shared/media/PublicDeferredEmbed";
import { FACEBOOK_PAGE_HEADER_HEIGHT, buildFacebookPagePluginUrl } from "../../utils/facebookPagePlugin";
import {
  normalizeHomepageSocialWidget,
  socialFacebookPageUrl,
  type HomepageSocialWidgetSettings
} from "../../../features/cms-settings/socialWidget";

function FacebookPageEmbed({ href }: { href: string }) {
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
  const url = width >= 180 ? buildFacebookPagePluginUrl(href, width) : "";
  return (
    <Box ref={frameContainerRef} sx={{ width: "100%", minWidth: 0, textAlign: "center" }}>
      {url ? (
        <PublicDeferredEmbed
          title="Facebook เพจวิทยาลัย"
          src={url}
          loadMode="near-viewport"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; web-share"
          scrolling="no"
          frameBorder="0"
          width="100%"
          height={FACEBOOK_PAGE_HEADER_HEIGHT}
          sx={{
            display: "block",
            mx: "auto",
            width: "100%",
            maxWidth: 500,
            height: FACEBOOK_PAGE_HEADER_HEIGHT,
            bgcolor: "background.paper",
            borderRadius: 1
          }}
        />
      ) : null}
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
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "center" }}>
                <FacebookIcon color="primary" />
                <Typography variant="h3">Facebook วิทยาลัย</Typography>
              </Stack>
              <FacebookPageEmbed href={facebookHref} />
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
