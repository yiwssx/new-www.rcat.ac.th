import { ReactNode } from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { MediaAsset, PublicContentCardItem } from "../../types";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { isFacebookEmbedContent } from "../../utils/facebookContent";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { contentStatusLabels, contentTypeLabels } from "../../utils/thaiLabels";
import { interactiveSurfaceSx } from "../../design-system/componentStyles";
import { resolveCardThumbnail } from "./publicContentCardThumbnail";

interface PublicContentCardProps {
  item: PublicContentCardItem;
  mediaAssets?: MediaAsset[];
  icon?: ReactNode;
  featured?: boolean;
}

function normalizeCategories(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PublicContentCard({
  item,
  mediaAssets = [],
  icon = <ArticleOutlinedIcon />,
  featured = false
}: PublicContentCardProps) {
  const thumbnailMedia = resolveCardThumbnail(item, mediaAssets);
  const categories = normalizeCategories(item.category);
  const isFacebookEmbed = isFacebookEmbedContent(item);

  return (
    <Card
      component="a"
      href={normalizeSafeHref(`/content/${item.slug}`)}
      className="block h-full"
      sx={{
        ...interactiveSurfaceSx,
        "&:hover": {
          transform: "translateY(-2px)",
          ...interactiveSurfaceSx["&:hover"]
        }
      }}
    >
      <CardContent sx={{ p: featured ? 3 : 2.4 }}>
        <Stack direction={featured ? { xs: "column", md: "row" } : "row"} spacing={2}>
          <Box
            className="rcat-image-frame grid place-items-center"
            data-public-content-card-media-slot={featured ? "featured" : "regular"}
            sx={{
              width: featured ? { xs: "100%", md: 180 } : 70,
              minWidth: featured ? { md: 180 } : 70,
              height: featured ? 150 : 70
            }}
          >
            {thumbnailMedia ? (
              <PublicResponsiveImage
                imageClassName="h-full w-full object-cover"
                source={thumbnailMedia}
                intent={featured ? "featured-card" : "content-card"}
                alt={thumbnailMedia.name}
                sizes={featured ? "(max-width: 899px) calc(100vw - 64px), 180px" : "70px"}
                loadMode="near-viewport"
                nearViewportMargin="240px 0px"
                fill
                fallback={icon}
                imageSx={{ objectFit: "cover" }}
              />
            ) : (
              icon
            )}
          </Box>
          <Box className="min-w-0 flex-1">
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{
                flexWrap: "wrap",
                mb: 1
              }}
            >
              <Chip label={contentTypeLabels[item.type]} size="small" />
              <Chip label={contentStatusLabels[item.status]} size="small" variant="outlined" />
              {isFacebookEmbed && <Chip label="Facebook" size="small" color="primary" variant="outlined" />}
              {item.featured && <Chip label="แนะนำ" size="small" color="secondary" />}
              {categories.slice(0, 2).map((category) => (
                <Chip key={category} label={category} size="small" variant="outlined" />
              ))}
              {!!item.readingMinutes && (
                <Chip label={`อ่าน ${item.readingMinutes} นาที`} size="small" variant="outlined" />
              )}
            </Stack>
            <Typography variant="h3" sx={{ fontSize: featured ? "1.45rem" : "1.05rem" }}>
              {item.title}
            </Typography>
            <Typography
              className="content-summary mt-2"
              sx={{
                color: "text.secondary"
              }}
            >
              {item.summary}
            </Typography>
            {!!item.tags?.length && (
              <Typography
                variant="caption"
                className="mt-2 block"
                sx={{
                  color: "text.secondary"
                }}
              >
                {item.tags
                  .slice(0, 4)
                  .map((tag) => `#${tag}`)
                  .join(" ")}
              </Typography>
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={0.5}
              sx={{
                justifyContent: "space-between",
                mt: 2
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary"
                }}
              >
                {item.owner}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary"
                }}
              >
                {formatDisplayDate(item.publishAt)}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
