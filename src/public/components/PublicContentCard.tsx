import { ReactNode } from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import { ContentItem, MediaAsset } from "../../types";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";
import { contentStatusLabels, contentTypeLabels } from "../../utils/thaiLabels";

interface PublicContentCardProps {
  item: ContentItem;
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
  const featuredMedia = mediaAssets.find((asset) => asset.id === item.featuredMediaId);
  const featuredMediaPreviewUrl = normalizeSafeResourceUrl(featuredMedia?.previewUrl);
  const categories = normalizeCategories(item.category);

  return (
    <Card
      component="a"
      href={normalizeSafeHref(`/content/${item.slug}`)}
      className="rcat-card"
      sx={{
        display: "block",
        height: "100%",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 18px 36px rgba(31, 90, 44, 0.14)"
        }
      }}
    >
      <CardContent sx={{ p: featured ? 3 : 2.4 }}>
        <Stack direction={featured ? { xs: "column", md: "row" } : "row"} spacing={2}>
          <Box
            className="rcat-image-frame"
            sx={{
              width: featured ? { xs: "100%", md: 180 } : 70,
              minWidth: featured ? { md: 180 } : 70,
              height: featured ? { xs: 150, md: 150 } : 70,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.light",
              color: "primary.main",
              overflow: "hidden"
            }}
          >
            {featuredMedia?.type === "image" && featuredMediaPreviewUrl ? (
              <Box
                component="img"
                src={featuredMediaPreviewUrl}
                alt={featuredMedia.name}
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              icon
            )}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip label={contentTypeLabels[item.type]} size="small" />
              <Chip label={contentStatusLabels[item.status]} size="small" variant="outlined" />
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
            <Typography color="text.secondary" sx={{ mt: 1 }} className="content-summary">
              {item.summary}
            </Typography>
            {!!item.tags?.length && (
              <Typography color="text.secondary" variant="caption" sx={{ mt: 1, display: "block" }}>
                {item.tags
                  .slice(0, 4)
                  .map((tag) => `#${tag}`)
                  .join(" ")}
              </Typography>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={0.5} justifyContent="space-between" sx={{ mt: 2 }}>
              <Typography color="text.secondary" variant="body2">
                {item.owner}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatDisplayDate(item.publishAt)}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
