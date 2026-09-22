import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { MediaAsset } from "../../types";
import { ContentBlock, FacebookPostContentBlock } from "../../utils/contentBlocks";
import PublicDeferredEmbed from "../media/PublicDeferredEmbed";
import FacebookReelSdkEmbed from "../media/FacebookReelSdkEmbed";
import PublicResponsiveImage from "../media/PublicResponsiveImage";
import PublicPdfViewer from "../media/PublicPdfViewer";
import { isPdfMediaAsset } from "../media/pdfMedia";
import { resolvePublicImageSource } from "../media/publicImageSources";
import {
  buildFacebookPostPluginUrl,
  clampFacebookPostPluginWidth,
  isFacebookReelUrl,
  isUnsupportedFacebookUrl,
  normalizeFacebookPostUrl
} from "../../utils/facebookEmbed";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";
import { designTokens } from "../../design-system/tokens";
import FlagEmojiText from "./FlagEmojiText";
import RichTextRenderer from "./RichTextRenderer";

interface ContentBlocksRendererProps {
  blocks: ContentBlock[];
  mediaAssets: MediaAsset[];
}

const defaultFacebookPostHeight = 761;
const maximumFacebookReelWidth = 440;

function FacebookPostEmbed({ block }: { block: FacebookPostContentBlock }) {
  const href = normalizeFacebookPostUrl(block.href);
  const isUnsupported = isUnsupportedFacebookUrl(block.href);
  const isReel = isFacebookReelUrl(href);
  const requestedWidth = clampFacebookPostPluginWidth(block.width || 500);
  const width = isReel ? Math.min(requestedWidth, maximumFacebookReelWidth) : requestedWidth;
  const pluginUrl = isReel ? "" : buildFacebookPostPluginUrl({ href, showText: block.showText, width });

  // If it's an unsafe or non-Facebook URL, render nothing.
  if (!href && !isUnsupported) {
    return null;
  }

  // Reels use Meta's XFBML video renderer. The post iframe plugin is reliable
  // for regular posts but is not the canonical Reel playback path.
  if (href && isReel) {
    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: width }}>
          <FacebookReelSdkEmbed href={href} preferredWidth={width} mode="video" showText={false} />
          <Button
            component="a"
            href={normalizeSafeHref(href)}
            target="_blank"
            rel="noreferrer"
            size="small"
            variant="text"
            sx={{ mt: 0.75, px: 0 }}
          >
            เปิด Reels บน Facebook
          </Button>
          {block.caption && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mt: 0.75
              }}
            >
              <FlagEmojiText text={block.caption} />
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // Regular posts use Facebook's iframe plugin on every breakpoint.
  if (href && pluginUrl) {
    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: width }}>
          <PublicDeferredEmbed
            title="Facebook post"
            src={pluginUrl}
            loadMode="near-viewport"
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            width={width}
            height={block.height || defaultFacebookPostHeight}
            sx={{
              width: "100%",
              maxWidth: width,
              height: block.height || defaultFacebookPostHeight,
              borderRadius: designTokens.radius.small
            }}
          />
          <Button
            component="a"
            href={normalizeSafeHref(href)}
            target="_blank"
            rel="noreferrer"
            size="small"
            variant="text"
            sx={{ mt: 0.75, px: 0 }}
          >
            เปิดโพสต์บน Facebook
          </Button>
          {block.caption && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mt: 0.75
              }}
            >
              <FlagEmojiText text={block.caption} />
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // If it's an unsupported Facebook URL, render fallback with message and link.
  if (isUnsupported && block.href) {
    const safeHref = normalizeSafeHref(block.href);
    const isValidHref = safeHref !== "#";

    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", textAlign: "center" }}>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 1.5
            }}
          >
            ไม่สามารถฝังเนื้อหา Facebook นี้ได้โดยตรง
          </Typography>
          {isValidHref && (
            <Button component="a" href={safeHref} target="_blank" rel="noreferrer" size="small" variant="outlined">
              เปิดโพสต์บน Facebook
            </Button>
          )}
          {block.caption && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mt: 1.5
              }}
            >
              <FlagEmojiText text={block.caption} />
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return null;
}

export default function ContentBlocksRenderer({ blocks, mediaAssets }: ContentBlocksRendererProps) {
  if (!blocks.length) {
    return null;
  }

  const mediaById = new Map(mediaAssets.map((asset) => [asset.id, asset]));

  return (
    <Stack spacing={2.25}>
      {blocks.map((block) => {
        if (block.type === "richText") {
          return <RichTextRenderer key={block.id} document={block.document} />;
        }

        if (block.type === "paragraph") {
          return (
            <Typography key={block.id} sx={{ whiteSpace: "pre-line" }}>
              <FlagEmojiText text={block.text} />
            </Typography>
          );
        }

        if (block.type === "heading") {
          const variant = block.level === 2 ? "h3" : block.level === 3 ? "h4" : "h5";
          return (
            <Typography key={block.id} variant={variant}>
              <FlagEmojiText text={block.text} />
            </Typography>
          );
        }

        if (block.type === "quote") {
          return (
            <Box
              key={block.id}
              sx={{
                borderLeft: "4px solid",
                borderColor: "primary.main",
                pl: 2,
                py: 0.5,
                bgcolor: "action.hover",
                borderRadius: `0 ${designTokens.radius.medium}px ${designTokens.radius.medium}px 0`
              }}
            >
              <Typography sx={{ fontStyle: "italic", mb: block.citation ? 0.75 : 0 }}>
                <FlagEmojiText text={block.text} />
              </Typography>
              {block.citation && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  <FlagEmojiText text={block.citation} />
                </Typography>
              )}
            </Box>
          );
        }

        if (block.type === "checklist") {
          return (
            <Stack key={block.id} spacing={0.75}>
              {block.items.map((item) => (
                <Stack
                  key={`${block.id}-${item}`}
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "flex-start"
                  }}
                >
                  <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 19, mt: 0.15, color: "primary.main" }} />
                  <Typography>
                    <FlagEmojiText text={item} />
                  </Typography>
                </Stack>
              ))}
            </Stack>
          );
        }

        if (block.type === "image") {
          const asset = mediaById.get(block.mediaId);
          const imageSource = resolvePublicImageSource(asset, "content-body");
          if (!asset || !imageSource.src) {
            return null;
          }

          return (
            <Box key={block.id}>
              <PublicResponsiveImage
                source={asset}
                intent="content-body"
                alt={block.caption || asset.name}
                sizes="(max-width: 900px) calc(100vw - 48px), 1100px"
                loadMode="near-viewport"
                nearViewportMargin="360px 0px"
                reservedMinHeight={{ xs: 180, md: 260 }}
                sx={{
                  width: "100%",
                  maxWidth: "100%",
                  borderRadius: designTokens.radius.medium,
                  bgcolor: "background.default"
                }}
                imageSx={{ objectFit: "contain" }}
              />
              {(block.caption || asset.name) && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    mt: 0.75
                  }}
                >
                  <FlagEmojiText text={block.caption || asset.name} />
                </Typography>
              )}
            </Box>
          );
        }

        if (block.type === "video") {
          const asset = mediaById.get(block.mediaId);
          const safeEmbedUrl = normalizeSafeResourceUrl(asset?.embedUrl);
          if (!asset || !safeEmbedUrl) {
            return null;
          }

          return (
            <Box key={block.id}>
              <PublicDeferredEmbed
                title={asset.name}
                src={safeEmbedUrl}
                sx={{ width: "100%", height: { xs: 240, md: 390 }, borderRadius: designTokens.radius.medium }}
                allow="autoplay"
              />
              {(block.caption || asset.name) && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    mt: 0.75
                  }}
                >
                  <FlagEmojiText text={block.caption || asset.name} />
                </Typography>
              )}
            </Box>
          );
        }

        if (block.type === "pdf") {
          const asset = mediaById.get(block.mediaId);

          if (!asset || !isPdfMediaAsset(asset)) {
            return null;
          }

          return <PublicPdfViewer key={block.id} asset={asset} caption={block.caption} />;
        }

        if (block.type === "facebookPost") {
          return <FacebookPostEmbed key={block.id} block={block} />;
        }

        if (block.type === "link") {
          const asset = block.source === "media" ? mediaById.get(block.mediaId) : undefined;
          const rawHref =
            block.source === "media" ? asset?.driveUrl || asset?.previewUrl || asset?.embedUrl || "" : block.href;
          const safeHref = normalizeSafeHref(rawHref);
          const isValidHref = safeHref !== "#";
          const label = block.label.trim() || (block.source === "media" ? asset?.name || "" : block.href.trim());

          if (!isValidHref || !label) {
            return null;
          }

          return (
            <Box key={block.id}>
              <Button
                component="a"
                href={safeHref}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={block.source === "media" ? <AttachFileOutlinedIcon /> : <LinkOutlinedIcon />}
              >
                <FlagEmojiText text={label} />
              </Button>
            </Box>
          );
        }

        if (block.type === "button") {
          const safeHref = normalizeSafeHref(block.href);
          const isValidHref = safeHref !== "#";

          return (
            <Box key={block.id}>
              <Button
                component={isValidHref ? "a" : "button"}
                href={isValidHref ? safeHref : undefined}
                disabled={!isValidHref}
                rel="noreferrer"
                variant={block.variant}
              >
                <FlagEmojiText text={block.label} />
              </Button>
            </Box>
          );
        }

        return <Divider key={block.id} />;
      })}
    </Stack>
  );
}
