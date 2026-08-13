import { useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Button, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
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
import { normalizePublicPageSearchValue } from "../routing/searchParams";
import { normalizeSafeHref } from "../../utils/safeUrl";

const NEWS_PAGE_SIZE = 12;

function readTextSearchParam(search: Record<string, unknown>, name: string) {
  const value = search[name];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategoryList(category: string | undefined) {
  return String(category || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PublicNewsPage() {
  const routeSearch = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const activeTag = readTextSearchParam(routeSearch, "tag");
  const activeCategory = readTextSearchParam(routeSearch, "category");
  const hasActiveFilter = Boolean(activeTag || activeCategory);
  const requestedPage = normalizePublicPageSearchValue(routeSearch.page) ?? 1;
  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList("news", undefined, {
    pageInput: hasActiveFilter ? undefined : { page: requestedPage, pageSize: NEWS_PAGE_SIZE }
  });
  const newsItems = useMemo(() => data?.items ?? [], [data?.items]);
  const mediaAssets = data?.media ?? [];
  const filteredNewsItems = useMemo(
    () =>
      hasActiveFilter
        ? newsItems.filter((item) => {
            const matchesTag = activeTag ? (item.tags ?? []).includes(activeTag) : true;
            const matchesCategory = activeCategory ? normalizeCategoryList(item.category).includes(activeCategory) : true;
            return matchesTag && matchesCategory;
          })
        : newsItems,
    [activeCategory, activeTag, hasActiveFilter, newsItems]
  );
  const serverPagination = hasActiveFilter ? undefined : data?.pagination;
  const archivePage = serverPagination?.page ?? requestedPage;
  const shouldFeatureFirstItem = !serverPagination || archivePage === 1;
  const featuredItem = shouldFeatureFirstItem ? filteredNewsItems[0] : undefined;
  const secondaryItems = shouldFeatureFirstItem ? filteredNewsItems.slice(1) : filteredNewsItems;
  const newsPagination = usePublicPagination(secondaryItems, {
    pageSize: NEWS_PAGE_SIZE,
    resetKeys: [activeTag, activeCategory],
    scrollTargetId: "news-list-heading",
    serverPagination
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
      <Stack
        id="news-list-heading"
        direction="row"
        spacing={1.2}
        sx={{
          alignItems: "center",
          mt: 4,
          mb: 2
        }}
      >
        <ArticleOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ข่าวทั้งหมด
        </Typography>
      </Stack>
      {hasActiveFilter && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{
            flexWrap: "wrap",
            alignItems: "center",
            mb: 2
          }}
        >
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
      {newsPagination.totalItems > 0 && newsPagination.pageCount > 1 && (
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
