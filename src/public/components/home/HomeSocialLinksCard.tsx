import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FacebookIcon from "@mui/icons-material/Facebook";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SocialLinkIcon from "../../../shared/components/SocialLinkIcon";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import { resolveCardThumbnail } from "../publicContentCardThumbnail";
import { isFacebookEmbedContent } from "../../../utils/facebookContent";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import type { MediaAsset, PublicContentCardItem } from "../../../types";
import PublicDeferredEmbed from "../../../shared/media/PublicDeferredEmbed";
import { buildFacebookPagePluginUrl } from "../../utils/facebookPagePlugin";
import {
  normalizeHomepageSocialWidget,
  socialFacebookPageUrl,
  type HomepageSocialWidgetSettings
} from "../../../features/cms-settings/socialWidget";

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
        <PublicDeferredEmbed
          title="Facebook เพจวิทยาลัย"
          src={url}
          loadMode="near-viewport"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; web-share"
          scrolling="no"
          frameBorder="0"
          width="100%"
          height={height}
          sx={{ display: "block", mx: "auto", width: "100%", maxWidth: 500, height }}
        />
      ) : null}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        หากไม่เห็นเนื้อหา Facebook อาจถูกจำกัดโดยเบราว์เซอร์ กรุณาเปิดเพจจากลิงก์ด้านล่าง
      </Typography>
    </Box>
  );
}

/**
 * Facebook controls its cross-origin Page iframe. Its onload event is not a
 * guarantee that Timeline posts appeared (a blank grey frame may still load).
 * Keep a useful first-party summary visible and mount the iframe only on demand.
 */
function RecentFacebookPosts({ posts, mediaAssets }: { posts: PublicContentCardItem[]; mediaAssets: MediaAsset[] }) {
  if (!posts.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        ติดตามข่าวสารและกิจกรรมล่าสุดได้จากเพจ Facebook ของวิทยาลัย
      </Typography>
    );
  }

  return (
    <Stack spacing={1} data-facebook-post-preview="true">
      <Typography variant="body2" color="text.secondary">
        ข่าวจาก Facebook ที่เผยแพร่บนเว็บไซต์
      </Typography>
      {posts.map((post) => {
        const image = resolveCardThumbnail(post, mediaAssets);
        return (
          <Box
            key={post.id}
            component="a"
            href={normalizeSafeHref(`/content/${post.slug}`)}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.25,
              minWidth: 0,
              p: 1.25,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              textDecoration: "none",
              color: "text.primary",
              "&:hover": { bgcolor: "action.hover" }
            }}
          >
            {image && (
              <Box
                sx={{
                  width: 76,
                  height: 66,
                  minWidth: 76,
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 1,
                  bgcolor: "action.hover"
                }}
              >
                <PublicResponsiveImage
                  source={image}
                  intent="content-card"
                  alt={post.title}
                  sizes="76px"
                  loadMode="near-viewport"
                  fill
                  imageSx={{ objectFit: "cover" }}
                />
              </Box>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere", lineHeight: 1.5 }}>
                {post.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDisplayDate(post.publishAt)}
              </Typography>
            </Box>
            <OpenInNewIcon aria-hidden="true" sx={{ fontSize: 16, color: "text.secondary" }} />
          </Box>
        );
      })}
    </Stack>
  );
}

export default function HomeSocialLinksCard({
  pageUrl,
  settings,
  posts = [],
  mediaAssets = []
}: {
  pageUrl: string;
  settings?: HomepageSocialWidgetSettings;
  posts?: PublicContentCardItem[];
  mediaAssets?: MediaAsset[];
}) {
  const [showIframe, setShowIframe] = useState(false);
  const widget = normalizeHomepageSocialWidget(settings);
  if (!widget.enabled) return null;
  const facebookHref = socialFacebookPageUrl(pageUrl);
  const recentFacebookPosts = posts.filter(isFacebookEmbedContent).slice(0, 3);
  const links = widget.links.filter(
    (item) => item.enabled && item.label && item.href && (item.iconKey !== "custom" || item.iconUrl)
  );
  if ((!widget.pageEmbedEnabled || !facebookHref) && links.length === 0) return null;

  return (
    <Card
      component="section"
      aria-label="ช่องทาง Facebook และหน่วยงาน"
      data-home-social-widget="true"
      sx={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2}>
          {widget.pageEmbedEnabled && facebookHref && (
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "center" }}>
                <FacebookIcon color="primary" />
                <Typography variant="h3">Facebook วิทยาลัย</Typography>
              </Stack>
              <RecentFacebookPosts posts={recentFacebookPosts} mediaAssets={mediaAssets} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5, alignItems: "flex-start" }}>
                <Button
                  size="small"
                  variant="contained"
                  href={facebookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNewIcon />}
                >
                  เปิด Facebook วิทยาลัย
                </Button>
                <Button
                  size="small"
                  variant="text"
                  aria-expanded={showIframe}
                  aria-controls="college-facebook-timeline"
                  onClick={() => setShowIframe((current) => !current)}
                >
                  {showIframe ? "ซ่อนไทม์ไลน์" : "ดูไทม์ไลน์จาก Facebook"}
                </Button>
              </Stack>
              {showIframe && (
                <Box id="college-facebook-timeline" data-facebook-expanded-timeline="true" sx={{ mt: 2 }}>
                  <FacebookPageEmbed href={facebookHref} height={widget.pageEmbedHeight} />
                </Box>
              )}
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
