import { useMemo } from "react";
import { Button, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState, { PublicBackgroundProgress } from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicContentList } from "../hooks/usePublicContentList";
import { usePublicPagination } from "../hooks/usePublicPagination";
import { normalizeSafeHref } from "../../utils/safeUrl";

const NEWS_PAGE_SIZE = 12;

function readSearchParam(name: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
}

function normalizeCategoryList(category: string | undefined) {
  return String(category || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PublicNewsPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList("news");
  const activeTag = readSearchParam("tag");
  const activeCategory = readSearchParam("category");
  const hasActiveFilter = Boolean(activeTag || activeCategory);
  const newsItems = useMemo(() => data?.items ?? [], [data?.items]);
  const mediaAssets = data?.media ?? [];
  const filteredNewsItems = useMemo(
    () =>
      newsItems.filter((item) => {
        const matchesTag = activeTag ? (item.tags ?? []).includes(activeTag) : true;
        const matchesCategory = activeCategory ? normalizeCategoryList(item.category).includes(activeCategory) : true;
        return matchesTag && matchesCategory;
      }),
    [activeCategory, activeTag, newsItems]
  );

  const [featuredItem, ...secondaryItems] = filteredNewsItems;
  const newsPagination = usePublicPagination(secondaryItems, {
    pageSize: NEWS_PAGE_SIZE,
    resetKeys: [activeTag, activeCategory],
    scrollTargetId: "news-list-heading"
  });

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell>
        <PublicLoadingState variant="listing" />
      </PublicSiteShell>
    );
  }

  if (!data && isError) {
    return (
      <PublicErrorState
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isFetching}
      />
    );
  }

  if (!data) {
    return (
      <PublicSiteShell>
        <PublicLoadingState variant="listing" />
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell
      title="ข่าว"
      description="กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
    >
      <PublicBackgroundProgress active={isFetching} />
      {featuredItem && (
        <PublicContentCard
          item={featuredItem}
          mediaAssets={mediaAssets}
          icon={<CampaignOutlinedIcon sx={{ fontSize: 58 }} />}
          featured
        />
      )}
      <Stack id="news-list-heading" direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
        <ArticleOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ข่าวทั้งหมด
        </Typography>
      </Stack>
      {hasActiveFilter && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
          {activeTag && <Chip label={`#${activeTag}`} color="secondary" />}
          {activeCategory && <Chip label={activeCategory} color="secondary" variant="outlined" />}
          <Button href={normalizeSafeHref("/news")} size="small">
            ล้างตัวกรอง
          </Button>
        </Stack>
      )}
      <Grid container spacing={2.5}>
        {newsPagination.paginatedItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard item={item} mediaAssets={mediaAssets} />
          </Grid>
        ))}
      </Grid>
      {secondaryItems.length > 0 && (
        <PublicPagination
          page={newsPagination.page}
          pageCount={newsPagination.pageCount}
          pageSize={newsPagination.pageSize}
          totalItems={newsPagination.totalItems}
          onPageChange={(nextPage) => newsPagination.setPage(nextPage, { scroll: true })}
        />
      )}
      {!filteredNewsItems.length && (
        <EmptyState
          title={hasActiveFilter ? "ไม่พบข่าวตามตัวกรองที่เลือก" : "ยังไม่มีข่าวที่เผยแพร่"}
          icon={<ArticleOutlinedIcon />}
        />
      )}
    </PublicSiteShell>
  );
}
