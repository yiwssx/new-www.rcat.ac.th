import { useEffect } from "react";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { MediaAsset } from "../../types";
import { ContentBlock, FacebookPostContentBlock } from "../../utils/contentBlocks";
import { normalizeFacebookPostUrl } from "../../utils/facebookEmbed";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";

interface ContentBlocksRendererProps {
  blocks: ContentBlock[];
  mediaAssets: MediaAsset[];
}

type FacebookSdkWindow = Window & {
  FB?: {
    XFBML?: {
      parse: () => void;
    };
  };
};

function clampFacebookPostWidth(value: number) {
  return Math.min(750, Math.max(350, Math.round(Number.isFinite(value) ? value : 500)));
}

function FacebookPostEmbed({ block }: { block: FacebookPostContentBlock }) {
  const href = normalizeFacebookPostUrl(block.href);
  const width = clampFacebookPostWidth(block.width || 500);

  useEffect(() => {
    if (!href || typeof window === "undefined") {
      return;
    }

    const scriptId = "facebook-jssdk";
    const existingScript = document.getElementById(scriptId);
    const parseFacebookEmbeds = () => {
      const fb = (window as FacebookSdkWindow).FB;
      fb?.XFBML?.parse?.();
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/th_TH/sdk.js#xfbml=1&version=v20.0";
      script.onload = parseFacebookEmbeds;
      document.body.appendChild(script);
      return;
    }

    parseFacebookEmbeds();
  }, [href]);

  if (!href) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <Box sx={{ width: "100%", maxWidth: width }}>
        <div
          className="fb-post"
          data-href={href}
          data-width={String(width)}
          data-show-text={block.showText ? "true" : "false"}
          data-lazy="true"
        />
        {block.caption && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {block.caption}
          </Typography>
        )}
      </Box>
    </Box>
  );
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
