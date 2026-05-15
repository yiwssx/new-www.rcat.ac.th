import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { MediaAsset } from "../../types";
import { ContentBlock, FacebookPostContentBlock } from "../../utils/contentBlocks";
import {
  buildFacebookPostPluginUrl,
  clampFacebookPostPluginWidth,
  isUnsupportedFacebookUrl,
  normalizeFacebookPostUrl
} from "../../utils/facebookEmbed";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";

interface ContentBlocksRendererProps {
  blocks: ContentBlock[];
  mediaAssets: MediaAsset[];
}

const defaultFacebookPostHeight = 761;

function FacebookPostEmbed({ block }: { block: FacebookPostContentBlock }) {
  const href = normalizeFacebookPostUrl(block.href);
  const isUnsupported = isUnsupportedFacebookUrl(block.href);
  const width = clampFacebookPostPluginWidth(block.width || 500);
  const pluginUrl = buildFacebookPostPluginUrl({ href, showText: block.showText, width });

  // If it's an unsafe or non-Facebook URL, render nothing
  if (!href && !isUnsupported) {
    return null;
  }

  // If it's a valid supported URL, render iframe
  if (href && pluginUrl) {
    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: width }}>
          <iframe
            title="Facebook post"
            src={pluginUrl}
            width={width}
            height={block.height || defaultFacebookPostHeight}
            loading="lazy"
            scrolling="no"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            style={{ border: 0, overflow: "hidden", width: "100%", maxWidth: width, borderRadius: 8 }}
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {block.caption}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // If it's an unsupported Facebook URL, render fallback with message and link
  if (isUnsupported && block.href) {
    const safeHref = normalizeSafeHref(block.href);
    const isValidHref = safeHref !== "#";

    return (
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            ไม่สามารถฝังโพสต์ Facebook นี้ได้โดยตรง
          </Typography>
          {isValidHref && (
            <Button component="a" href={safeHref} target="_blank" rel="noreferrer" size="small" variant="outlined">
              เปิดโพสต์บน Facebook
            </Button>
          )}
          {block.caption && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {block.caption}
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
        if (block.type === "paragraph") {
          return (
            <Typography key={block.id} sx={{ whiteSpace: "pre-line" }}>
              {block.text}
            </Typography>
          );
        }

        if (block.type === "heading") {
          const variant = block.level === 2 ? "h3" : block.level === 3 ? "h4" : "h5";
          return (
            <Typography key={block.id} variant={variant}>
              {block.text}
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
                bgcolor: "rgba(31, 90, 44, 0.04)",
                borderRadius: "0 10px 10px 0"
              }}
            >
              <Typography sx={{ fontStyle: "italic", mb: block.citation ? 0.75 : 0 }}>{block.text}</Typography>
              {block.citation && (
                <Typography variant="body2" color="text.secondary">
                  {block.citation}
                </Typography>
              )}
            </Box>
          );
        }

        if (block.type === "checklist") {
          return (
            <Stack key={block.id} spacing={0.75}>
              {block.items.map((item) => (
                <Stack key={`${block.id}-${item}`} direction="row" spacing={1} alignItems="flex-start">
                  <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 19, mt: 0.15, color: "primary.main" }} />
                  <Typography>{item}</Typography>
                </Stack>
              ))}
            </Stack>
          );
        }

        if (block.type === "image") {
          const asset = mediaById.get(block.mediaId);
          const safePreviewUrl = normalizeSafeResourceUrl(asset?.previewUrl);
          if (!asset || !safePreviewUrl) {
            return null;
          }

          return (
            <Box key={block.id}>
              <Box
                component="img"
                src={safePreviewUrl}
                alt={block.caption || asset.name}
                sx={{ width: "100%", borderRadius: 2, maxHeight: 460, objectFit: "cover" }}
              />
              {(block.caption || asset.name) && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {block.caption || asset.name}
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
              <Box
                component="iframe"
                title={asset.name}
                src={safeEmbedUrl}
                sx={{ width: "100%", height: { xs: 240, md: 390 }, border: 0, borderRadius: 2 }}
                allow="autoplay"
              />
              {(block.caption || asset.name) && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {block.caption || asset.name}
                </Typography>
              )}
            </Box>
          );
        }

        if (block.type === "facebookPost") {
          return <FacebookPostEmbed key={block.id} block={block} />;
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
                {block.label}
              </Button>
            </Box>
          );
        }

        return <Divider key={block.id} />;
      })}
    </Stack>
  );
}
