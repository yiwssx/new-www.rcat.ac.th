import {
  useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import ContentBlocksRenderer from "../../shared/components/ContentBlocksRenderer";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";
import { usePublicContentDetail } from "../hooks/usePublicContentDetail";
import { parseContentBodyToBlocks } from "../../utils/contentBlocks";
import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";
import { contentStatusLabels, contentTypeLabels } from "../../utils/thaiLabels";

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

function getSafeMediaHref(asset: { driveUrl?: string; previewUrl?: string; embedUrl?: string }) {
  const candidates = [asset.driveUrl, asset.previewUrl, asset.embedUrl];

  for (const candidate of candidates) {
    const safeHref = normalizeSafeHref(candidate || "");

    if (safeHref !== "#") {
      return safeHref;
    }
  }

  return "#";
}

export default function PublicContentDetailPage({ slug }: PublicContentDetailPageProps) {
  const { data, isLoading } = usePublicCmsSnapshot();
  const contentDetailQuery = usePublicContentDetail({ slug });

  const visibleContent = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.status === "published")
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );
  const item = contentDetailQuery.data;
  const mediaAssets = data?.media ?? [];
  const contentBlocks = useMemo(() => parseContentBodyToBlocks(item?.body), [item?.body]);
  const featuredMedia = mediaAssets.find((asset) => asset.id === item?.featuredMediaId);
  const featuredMediaPreviewUrl = normalizeSafeResourceUrl(featuredMedia?.previewUrl);
  const featuredMediaEmbedUrl = normalizeSafeResourceUrl(featuredMedia?.embedUrl);
  const canonicalHref = normalizeSafeHref(item?.canonicalUrl || "");
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
      <PublicSiteShell title="กำลังโหลด" description="กำลังโหลดเนื้อหาสาธารณะจาก CMS">
        <LinearProgress />
      </PublicSiteShell>
    );
  }

  if (!item || item.status !== "published") {
    return (
      <PublicSiteShell title="ไม่พบเนื้อหา" description="เนื้อหา CMS ที่ร้องขอยังไม่ได้เผยแพร่ในขณะนี้">
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography color="text.secondary">
              เนื้อหาอาจยังไม่เผยแพร่ ถูกย้าย หรือไม่พร้อมให้แสดงต่อสาธารณะ
            </Typography>
            <Button href="/news" sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />}>
              กลับไปหน้าข่าว
            </Button>
          </CardContent>
        </Card>
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell
      title={item.title}
      description={item.summary}
      seoTitle={item.seoTitle || item.title}
      seoDescription={item.seoDescription || item.summary}
      canonicalUrl={item.canonicalUrl}
      canonicalPath={`/content/${item.slug || slug || ""}`}
    >
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <Chip label={contentTypeLabels[item.type]} color="primary" />
                <Chip label={contentStatusLabels[item.status]} variant="outlined" />
                <Chip label={formatDisplayDate(item.publishAt)} variant="outlined" />
                {item.featured && <Chip label="แนะนำ" color="secondary" />}
                {normalizeCategoryList(item.category).slice(0, 3).map((category) => (
                  <Chip key={category} label={category} variant="outlined" />
                ))}
                {!!item.readingMinutes && <Chip label={`อ่าน ${item.readingMinutes} นาที`} variant="outlined" />}
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
                {featuredMedia?.type === "image" && featuredMediaPreviewUrl ? (
                  <Box
                    component="img"
                    src={featuredMediaPreviewUrl}
                    alt={featuredMedia.name}
                    sx={{ width: "100%", height: { xs: 220, md: 360 }, objectFit: "cover" }}
                  />
                ) : featuredMedia?.type === "video" && featuredMediaEmbedUrl ? (
                  <Box
                    component="iframe"
                    title={featuredMedia.name}
                    src={featuredMediaEmbedUrl}
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
                  <EmptyState title="ยังไม่มีรายละเอียดเนื้อหาที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h3">รายละเอียดเนื้อหา</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1.2}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      ผู้รับผิดชอบ
                    </Typography>
                    <Typography fontWeight={900}>{item.owner}</Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      ปรับปรุงล่าสุด
                    </Typography>
                    <Typography fontWeight={900}>{formatDisplayDateTime(item.updatedAt)}</Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      เผยแพร่
                    </Typography>
                    <Typography fontWeight={900}>{formatDisplayDateTime(item.publishAt)}</Typography>
                  </Box>
                  {!!item.template && (
                    <Box>
                      <Typography color="text.secondary" variant="body2">
                        เทมเพลต
                      </Typography>
                      <Typography fontWeight={900} sx={{ textTransform: "capitalize" }}>
                        {item.template}
                      </Typography>
                    </Box>
                  )}
                  {!!item.canonicalUrl && (
                    <Button
                      component="a"
                      href={canonicalHref}
                      target="_blank"
                      rel="noreferrer"
                      variant="outlined"
                      sx={{ justifyContent: "flex-start" }}
                    >
                      URL หลัก
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
            {!!attachedMedia.length && (
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="h3">สื่อแนบ</Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack spacing={1.2}>
                    {attachedMedia.map((asset) => (
                      <Button
                        key={asset.id}
                        component="a"
                        href={getSafeMediaHref(asset)}
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
              กลับไปหน้ารายการ
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {relatedItems.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h2" sx={{ fontSize: "1.65rem", mb: 2 }}>
            เนื้อหาที่เกี่ยวข้อง
          </Typography>
          <Grid container spacing={2.5}>
            {relatedItems.map((relatedItem) => (
              <Grid size={{ xs: 12, md: 4 }} key={relatedItem.id}>
                <PublicContentCard item={relatedItem} mediaAssets={mediaAssets} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </PublicSiteShell>
  );
}
