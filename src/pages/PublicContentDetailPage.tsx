import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import dayjs from "dayjs";
import ContentBlocksRenderer from "../components/ContentBlocksRenderer";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { getCmsSnapshot, getContentDetail } from "../services/googleApi";
import { parseContentBodyToBlocks } from "../utils/contentBlocks";

interface PublicContentDetailPageProps {
  slug?: string;
}

function normalizeTags(tags: string[] | undefined) {
  return Array.isArray(tags) ? tags.filter(Boolean) : [];
}

function normalizeCategoryList(category: string | undefined) {
  return String(category || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sharedTagScore(left: string[] | undefined, right: string[] | undefined) {
  const leftTags = normalizeTags(left);
  const rightTags = normalizeTags(right);
  const rightLookup = new Set(rightTags);
  return leftTags.filter((tag) => rightLookup.has(tag)).length;
}

function sharedCategoryScore(left: string | undefined, right: string | undefined) {
  const leftCategories = normalizeCategoryList(left);
  const rightCategories = normalizeCategoryList(right);
  const rightLookup = new Set(rightCategories);
  return leftCategories.filter((item) => rightLookup.has(item)).length;
}

function getReturnPath(type: string) {
  if (type === "announcement") {
    return "/announcements";
  }

  if (type === "program") {
    return "/departments";
  }

  if (type === "blog") {
    return "/blog";
  }

  return "/news";
}

export default function PublicContentDetailPage({ slug }: PublicContentDetailPageProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });
  const contentDetailQuery = useQuery({
    queryKey: ["content-detail", slug],
    queryFn: async () => getContentDetail({ slug }),
    enabled: Boolean(slug)
  });

  const visibleContent = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.status === "published" || item.status === "scheduled")
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );
  const item = contentDetailQuery.data;
  const mediaAssets = data?.media ?? [];
  const contentBlocks = useMemo(() => parseContentBodyToBlocks(item?.body), [item?.body]);
  const featuredMedia = mediaAssets.find((asset) => asset.id === item?.featuredMediaId);
  const attachedMedia = mediaAssets.filter((asset) => item?.mediaIds?.includes(asset.id));
  const relatedItems = useMemo(() => {
    if (!item) {
      return [];
    }

    return visibleContent
      .filter((candidate) => candidate.id !== item.id)
      .map((candidate) => {
        const score =
          (candidate.type === item.type ? 4 : 0) +
          sharedCategoryScore(candidate.category, item.category) * 3 +
          sharedTagScore(candidate.tags, item.tags);

        return {
          candidate,
          score
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return new Date(right.candidate.publishAt).getTime() - new Date(left.candidate.publishAt).getTime();
      })
      .filter((entry) => entry.score > 0)
      .slice(0, 3)
      .map((entry) => entry.candidate);
  }, [item, visibleContent]);

  if (isLoading || contentDetailQuery.isLoading) {
    return (
      <PublicSiteShell title="Loading" description="Loading public content from the CMS.">
        <LinearProgress />
      </PublicSiteShell>
    );
  }

  if (!item || (item.status !== "published" && item.status !== "scheduled")) {
    return (
      <PublicSiteShell title="Content Not Found" description="The requested CMS content is not currently published.">
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography color="text.secondary">
              The content may be unpublished, moved, or unavailable for public viewing.
            </Typography>
            <Button href="/news" sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />}>
              Back to news
            </Button>
          </CardContent>
        </Card>
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell title={item.title} description={item.summary}>
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <Chip label={item.type} color="primary" sx={{ textTransform: "capitalize" }} />
                <Chip label={item.status} variant="outlined" sx={{ textTransform: "capitalize" }} />
                <Chip label={dayjs(item.publishAt).format("DD MMM YYYY")} variant="outlined" />
                {item.featured && <Chip label="Featured" color="secondary" />}
                {normalizeCategoryList(item.category).slice(0, 3).map((category) => (
                  <Chip key={category} label={category} variant="outlined" />
                ))}
                {!!item.readingMinutes && <Chip label={`${item.readingMinutes} min read`} variant="outlined" />}
                {normalizeTags(item.tags).slice(0, 4).map((tag) => (
                  <Chip key={tag} label={`#${tag}`} variant="outlined" />
                ))}
              </Stack>
              <Box
                sx={{
                  minHeight: { xs: 180, md: 260 },
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.light",
                  color: "primary.main",
                  mb: 3,
                  overflow: "hidden"
                }}
              >
                {featuredMedia?.type === "image" && featuredMedia.previewUrl ? (
                  <Box
                    component="img"
                    src={featuredMedia.previewUrl}
                    alt={featuredMedia.name}
                    sx={{ width: "100%", height: { xs: 220, md: 360 }, objectFit: "cover" }}
                  />
                ) : featuredMedia?.type === "video" && featuredMedia.embedUrl ? (
                  <Box
                    component="iframe"
                    title={featuredMedia.name}
                    src={featuredMedia.embedUrl}
                    sx={{ width: "100%", height: { xs: 240, md: 390 }, border: 0 }}
                    allow="autoplay"
                  />
                ) : (
                  <ArticleOutlinedIcon sx={{ fontSize: 92 }} />
                )}
              </Box>
              <Typography variant="h2" sx={{ fontSize: { xs: "1.55rem", md: "2rem" } }}>
                {item.seoTitle || item.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: "1.05rem" }}>
                {item.seoDescription || item.summary}
              </Typography>
              <Divider sx={{ my: 3 }} />
              <Stack spacing={2}>
                {contentBlocks.length ? (
                  <ContentBlocksRenderer blocks={contentBlocks} mediaAssets={mediaAssets} />
                ) : (
                  <>
                    <Typography>
                      This public page presents the latest information prepared by {item.owner}. Visitors can
                      use this content for admissions planning, campus activity updates, program review, or
                      official college communication depending on the content category.
                    </Typography>
                    <Typography>
                      For questions about this item, please contact the responsible office listed below or use
                      the contact page to reach the public relations team.
                    </Typography>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h3">Content Details</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1.2}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Owner
                    </Typography>
                    <Typography fontWeight={900}>{item.owner}</Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Updated
                    </Typography>
                    <Typography fontWeight={900}>{dayjs(item.updatedAt).format("DD MMM YYYY HH:mm")}</Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Published
                    </Typography>
                    <Typography fontWeight={900}>{dayjs(item.publishAt).format("DD MMM YYYY HH:mm")}</Typography>
                  </Box>
                  {!!item.template && (
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        Template
                      </Typography>
                      <Typography fontWeight={900} sx={{ textTransform: "capitalize" }}>
                        {item.template}
                      </Typography>
                    </Box>
                  )}
                  {!!item.canonicalUrl && (
                    <Button
                      component="a"
                      href={item.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="outlined"
                      sx={{ justifyContent: "flex-start" }}
                    >
                      Canonical URL
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
            {!!attachedMedia.length && (
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h3">Attached Media</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack spacing={1.2}>
                    {attachedMedia.map((asset) => (
                      <Button
                        key={asset.id}
                        component="a"
                        href={asset.driveUrl || asset.previewUrl || asset.embedUrl}
                        target="_blank"
                        rel="noreferrer"
                        variant="outlined"
                        startIcon={asset.type === "video" ? <OndemandVideoOutlinedIcon /> : <InsertDriveFileOutlinedIcon />}
                        sx={{ justifyContent: "flex-start" }}
                      >
                        {asset.name}
                      </Button>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
            <Button href={getReturnPath(item.type)} startIcon={<ArrowBackOutlinedIcon />}>
              Back to list
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {relatedItems.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h2" sx={{ fontSize: "1.65rem", mb: 2 }}>
            Related Content
          </Typography>
          <Grid container spacing={2.5}>
            {relatedItems.map((relatedItem) => (
              <Grid item xs={12} md={4} key={relatedItem.id}>
                <PublicContentCard item={relatedItem} mediaAssets={mediaAssets} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </PublicSiteShell>
  );
}
