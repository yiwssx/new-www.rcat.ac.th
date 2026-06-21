import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/th";
import { Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import ContentBlocksRenderer from "../../shared/components/ContentBlocksRenderer";
import EmptyState from "../../shared/components/EmptyState";
import { recordContentView } from "../../features/site-view";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";
import { usePublicContentDetail } from "../hooks/usePublicContentDetail";
import { parseContentBodyToBlocks } from "../../utils/contentBlocks";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";
import { contentStatusLabels, contentTypeLabels } from "../../utils/thaiLabels";
import { ContentItem, MediaAsset } from "../../types";

interface PublicContentDetailPageProps {
  slug?: string;
}

const viewCountDebounceTtlMs = 6 * 60 * 60 * 1000;

const focusVisibleSx = {
  "&:focus-visible": {
    outline: "3px solid",
    outlineColor: "secondary.main",
    outlineOffset: 3
  }
};

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

function getFilterListPath(type: string) {
  if (type === "announcement") {
    return "/announcements";
  }

  if (type === "news" || type === "blog") {
    return "/news";
  }

  return getReturnPath(type);
}

function getFilterHref(type: string, key: "tag" | "category", value: string) {
  return `${getFilterListPath(type)}?${key}=${encodeURIComponent(value)}`;
}

function getViewCountStorageKey(item: { id?: string; slug?: string }) {
  const lookupKey = item.id || item.slug || "";
  return lookupKey ? `rcat.cms.viewed.${lookupKey}` : "";
}

function shouldRecordContentView(storageKey: string) {
  if (!storageKey || typeof window === "undefined") {
    return false;
  }

  try {
    const savedAt = Number(window.localStorage.getItem(storageKey) || 0);
    return !savedAt || savedAt + viewCountDebounceTtlMs <= Date.now();
  } catch {
    return false;
  }
}

function markContentViewRecorded(storageKey: string) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // Ignore storage failures; view counting must not affect article rendering.
  }
}

function formatViewCount(value: number | undefined) {
  return Math.max(0, Number(value) || 0).toLocaleString("th-TH");
}

function formatContentDetailThaiDate(value: string | Date) {
  const parsed = dayjs(value).locale("th");

  if (!parsed.isValid()) {
    return "";
  }

  return `${parsed.format("D MMMM")} ${parsed.year() + 543}`;
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

function ContentDetailMetadata({
  item,
  tagList,
  displayedViewCount
}: {
  item: ContentItem;
  tagList: string[];
  displayedViewCount: number;
}) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={contentTypeLabels[item.type]} color="primary" />
        <Chip label={contentStatusLabels[item.status]} variant="outlined" />
        <Chip label={formatContentDetailThaiDate(item.publishAt)} variant="outlined" />
        <Chip label={`ผู้เผยแพร่: ${item.owner || "ไม่ระบุ"}`} variant="outlined" />
        <Chip label={`ผู้เข้าดู ${formatViewCount(displayedViewCount)} ครั้ง`} variant="outlined" />
      </Stack>
      {!!tagList.length && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {tagList.map((tag) => (
            <Chip
              key={tag}
              component="a"
              clickable
              href={normalizeSafeHref(getFilterHref(item.type, "tag", tag))}
              label={`#${tag}`}
              variant="outlined"
              sx={focusVisibleSx}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function AttachedMediaSection({ attachedMedia }: { attachedMedia: MediaAsset[] }) {
  if (!attachedMedia.length) {
    return null;
  }

  return (
    <Box
      className="rcat-card-muted"
      sx={{
        p: { xs: 2, md: 2.5 }
      }}
    >
      <Typography variant="h3">สื่อแนบ</Typography>
      <Divider sx={{ my: 1.5 }} />
      <Grid container spacing={1.2}>
        {attachedMedia.map((asset) => (
          <Grid size={{ xs: 12, sm: 6 }} key={asset.id}>
            <Button
              component="a"
              href={getSafeMediaHref(asset)}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              fullWidth
              startIcon={asset.type === "video" ? <OndemandVideoOutlinedIcon /> : <InsertDriveFileOutlinedIcon />}
              sx={{ justifyContent: "flex-start", minHeight: 44, ...focusVisibleSx }}
            >
              {asset.name}
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default function PublicContentDetailPage({ slug }: PublicContentDetailPageProps) {
  const { data, isLoading, isFetching } = usePublicCmsSnapshot();
  const contentDetailQuery = usePublicContentDetail({ slug });
  const [recordedViewCountState, setRecordedViewCountState] = useState<{
    count: number | null;
    storageKey: string;
  }>({
    count: null,
    storageKey: ""
  });

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
  const isInitialSnapshotLoading = !data && (isLoading || isFetching);
  const isInitialContentLoading = !item && (contentDetailQuery.isLoading || contentDetailQuery.isFetching);

  useEffect(() => {
    if (!item || item.status !== "published") {
      return;
    }

    const storageKey = getViewCountStorageKey(item);

    if (!shouldRecordContentView(storageKey)) {
      return;
    }

    void recordContentView({ id: item.id, slug: item.slug })
      .then((response) => {
        markContentViewRecorded(storageKey);
        setRecordedViewCountState({
          count: response.viewCount,
          storageKey
        });
      })
      .catch(() => {
        // Public content should render even when view tracking is unavailable.
      });
  }, [item]);

  if (isInitialSnapshotLoading || isInitialContentLoading) {
    return (
      <PublicSiteShell hidePageHeader seoTitle="" seoDescription="" canonicalPath={`/content/${slug || ""}`}>
        <LinearProgress />
      </PublicSiteShell>
    );
  }

  if (!data) {
    return <PublicSiteShell>{null}</PublicSiteShell>;
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

  const viewCountStorageKey = getViewCountStorageKey(item);
  const recordedViewCount =
    recordedViewCountState.storageKey === viewCountStorageKey ? recordedViewCountState.count : null;
  const displayedViewCount = recordedViewCount ?? item.viewCount ?? 0;
  const tagList = normalizeTags(item.tags);

  if (item.type === "announcement") {
    return (
      <PublicSiteShell
        title={item.title}
        description={item.summary}
        seoTitle={item.seoTitle || item.title}
        seoDescription={item.seoDescription || item.summary}
        canonicalUrl={item.canonicalUrl}
        canonicalPath={`/content/${item.slug || slug || ""}`}
      >
        <Box className="rcat-content-detail-shell max-w-[960px]">
          <Button href={normalizeSafeHref("/announcements")} startIcon={<ArrowBackOutlinedIcon />} sx={{ mb: 2 }}>
            กลับไปหน้าประกาศ
          </Button>
          <Card component="article" className="rcat-card">
            <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={2.4}>
                <ContentDetailMetadata item={item} tagList={tagList} displayedViewCount={displayedViewCount} />

                <Box>
                  <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "3.2rem" }, lineHeight: 1.12 }}>
                    {item.seoTitle || item.title}
                  </Typography>
                  {(item.seoDescription || item.summary) && (
                    <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: { xs: "1rem", md: "1.12rem" } }}>
                      {item.seoDescription || item.summary}
                    </Typography>
                  )}
                </Box>

                {featuredMedia?.type === "image" && featuredMediaPreviewUrl && (
                  <Box
                    component="img"
                    className="rcat-image-frame"
                    src={featuredMediaPreviewUrl}
                    alt={featuredMedia.name}
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                    sx={{
                      width: "100%",
                      height: { xs: 220, md: 430 },
                      borderRadius: 2,
                      objectFit: "cover",
                      display: "block"
                    }}
                  />
                )}
                {featuredMedia?.type === "video" && featuredMediaEmbedUrl && (
                  <Box
                    component="iframe"
                    className="rcat-image-frame"
                    title={featuredMedia.name}
                    src={featuredMediaEmbedUrl}
                    loading="lazy"
                    sx={{ width: "100%", height: { xs: 240, md: 430 }, border: 0, borderRadius: 2 }}
                    allow="autoplay"
                  />
                )}

                <Divider />

                {contentBlocks.length ? (
                  <ContentBlocksRenderer blocks={contentBlocks} mediaAssets={mediaAssets} />
                ) : (
                  <EmptyState title="ยังไม่มีรายละเอียดประกาศที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
                )}

                {!!attachedMedia.length && (
                  <Box className="rcat-card-muted" sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Typography variant="h3" sx={{ mb: 1.5 }}>
                      เอกสารแนบ
                    </Typography>
                    <Stack spacing={1.2}>
                      {attachedMedia.map((asset) => (
                        <Button
                          key={asset.id}
                          component="a"
                          href={getSafeMediaHref(asset)}
                          target="_blank"
                          rel="noreferrer"
                          variant="outlined"
                          startIcon={
                            asset.type === "video" ? <OndemandVideoOutlinedIcon /> : <InsertDriveFileOutlinedIcon />
                          }
                          sx={{ justifyContent: "flex-start", ...focusVisibleSx }}
                        >
                          {asset.name}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Button href={normalizeSafeHref("/announcements")} startIcon={<ArrowBackOutlinedIcon />} sx={{ mt: 2.5 }}>
            กลับไปหน้าประกาศ
          </Button>

          {relatedItems.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h2" sx={{ fontSize: "1.65rem", mb: 2 }}>
                ประกาศที่เกี่ยวข้อง
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
        </Box>
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
      <Box className="rcat-content-detail-shell">
        <Card component="article" className="rcat-card">
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Stack spacing={2.5}>
              <ContentDetailMetadata item={item} tagList={tagList} displayedViewCount={displayedViewCount} />
              <Box
                className="rcat-image-frame"
                sx={{
                  minHeight: { xs: 180, md: 260 },
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.light",
                  color: "primary.main"
                }}
              >
                {featuredMedia?.type === "image" && featuredMediaPreviewUrl ? (
                  <Box
                    component="img"
                    src={featuredMediaPreviewUrl}
                    alt={featuredMedia.name}
                    loading="eager"
                    decoding="async"
                    {...({ fetchpriority: "high" } as Record<string, string>)}
                    sx={{ width: "100%", height: { xs: 220, md: 360 }, objectFit: "cover" }}
                  />
                ) : featuredMedia?.type === "video" && featuredMediaEmbedUrl ? (
                  <Box
                    component="iframe"
                    title={featuredMedia.name}
                    src={featuredMediaEmbedUrl}
                    loading="lazy"
                    sx={{ width: "100%", height: { xs: 240, md: 390 }, border: 0 }}
                    allow="autoplay"
                  />
                ) : (
                  <ArticleOutlinedIcon sx={{ fontSize: 92 }} />
                )}
              </Box>
              <Box>
                <Typography variant="h2" sx={{ fontSize: { xs: "1.55rem", md: "2rem" } }}>
                  {item.seoTitle || item.title}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: "1.05rem" }}>
                  {item.seoDescription || item.summary}
                </Typography>
              </Box>
              <Divider />
              <Stack spacing={2}>
                {contentBlocks.length ? (
                  <ContentBlocksRenderer blocks={contentBlocks} mediaAssets={mediaAssets} />
                ) : (
                  <EmptyState title="ยังไม่มีเนื้อหาที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
                )}
              </Stack>
              <AttachedMediaSection attachedMedia={attachedMedia} />
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ mt: 2.5 }}>
          <Button
            href={getReturnPath(item.type)}
            startIcon={<ArrowBackOutlinedIcon />}
            sx={{ width: { xs: "100%", sm: "auto" }, ...focusVisibleSx }}
          >
            กลับไปหน้ารายการ
          </Button>
        </Box>

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
      </Box>
    </PublicSiteShell>
  );
}
