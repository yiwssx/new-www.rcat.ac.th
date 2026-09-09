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
  presentation?: "default" | "home-news";
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
  featured = false,
  presentation = "default"
}: PublicContentCardProps) {
  const thumbnailMedia = resolveCardThumbnail(item, mediaAssets);
  const categories = normalizeCategories(item.category);
  const isFacebookEmbed = isFacebookEmbedContent(item);
  const isHomeNews = presentation === "home-news" && !featured;

  return (
    <Card
      component="a"
      href={normalizeSafeHref(`/content/${item.slug}`)}
      className="block h-full"
      data-public-content-card-presentation={presentation}
      sx={{
        ...interactiveSurfaceSx,
        "&:hover": {
          transform: "translateY(-2px)",
          ...interactiveSurfaceSx["&:hover"]
        }
      }}
    >
      <CardContent sx={{ p: featured ? 3 : isHomeNews ? 2.25 : 2.4 }}>
        <Stack direction={featured ? { xs: "column", md: "row" } : "row"} spacing={isHomeNews ? 1.5 : 2}>
          <Box
            className="rcat-image-frame grid place-items-center"
            data-public-content-card-media-slot={featured ? "featured" : "regular"}
            sx={{
              width: featured ? { xs: "100%", md: 180 } : isHomeNews ? 120 : 70,
              minWidth: featured ? { md: 180 } : isHomeNews ? 120 : 70,
              height: featured ? 150 : isHomeNews ? 90 : 70
            }}
          >
            {thumbnailMedia ? (
              <PublicResponsiveImage
                imageClassName="h-full w-full object-cover"
                source={thumbnailMedia}
                intent={featured ? "featured-card" : "content-card"}
                alt={thumbnailMedia.name}
                sizes={featured ? "(max-width: 899px) calc(100vw - 64px), 180px" : isHomeNews ? "120px" : "70px"}
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
              spacing={isHomeNews ? 0.75 : 1}
              useFlexGap
              sx={{
                flexWrap: "wrap",
                mb: isHomeNews ? 0.75 : 1,
                ...(isHomeNews
                  ? {
                      "& .MuiChip-root": {
                        height: 24,
                        fontSize: "0.6875rem"
                      },
                      "& .MuiChip-label": {
                        px: 1
                      }
                    }
                  : {})
              }}
            >
              <Chip label={contentTypeLabels[item.type]} size="small" />
              <Chip label={contentStatusLabels[item.status]} size="small" variant="outlined" />
              {isFacebookEmbed && <Chip label="Facebook" size="small" color="primary" variant="outlined" />}
              {item.featured && <Chip label="แนะนำ" size="small" color="secondary" />}
              {categories.slice(0, 2).map((category) => (
                <Chip key={category} label={category} size="small" variant="outlined" />
              ))}
              {!isHomeNews && !!item.readingMinutes && (
                <Chip label={`อ่าน ${item.readingMinutes} นาที`} size="small" variant="outlined" />
              )}
            </Stack>
            <Typography
              variant="h3"
              sx={{
                fontSize: featured ? "1.45rem" : isHomeNews ? "0.9375rem" : "1.05rem",
                ...(isHomeNews
                  ? {
                      fontWeight: 600,
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      overflow: "hidden",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3
                    }
                  : {})
              }}
            >
              {item.title}
            </Typography>
            <Typography
              className="content-summary mt-2"
              sx={{
                color: "text.secondary",
                ...(isHomeNews
                  ? {
                      fontSize: "0.8125rem",
                      lineHeight: 1.5
                    }
                  : {})
              }}
            >
              {item.summary}
            </Typography>
            {!!item.tags?.length && (
              <Typography
                variant="caption"
                className="mt-2 block"
                sx={{
                  color: "text.secondary",
                  ...(isHomeNews
                    ? {
                        fontSize: "0.71875rem",
                        lineHeight: 1.4
                      }
                    : {})
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
                mt: isHomeNews ? 1.5 : 2
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  ...(isHomeNews ? { fontSize: "0.75rem" } : {})
                }}
              >
                {item.owner}
                {isHomeNews && !!item.readingMinutes ? ` · อ่าน ${item.readingMinutes} นาที` : ""}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  ...(isHomeNews ? { fontSize: "0.75rem" } : {})
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
