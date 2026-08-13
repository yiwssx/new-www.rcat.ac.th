import { useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Button, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState, { PublicBackgroundProgress } from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicContentList } from "../hooks/usePublicContentList";
import { usePublicPagination } from "../hooks/usePublicPagination";
import { normalizeSafeHref } from "../../utils/safeUrl";

const BLOG_PAGE_SIZE = 12;

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

export default function PublicBlogPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList("blog");
  const routeSearch = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const activeTag = readTextSearchParam(routeSearch, "tag");
  const activeCategory = readTextSearchParam(routeSearch, "category");
  const hasActiveFilter = Boolean(activeTag || activeCategory);
  const blogItems = useMemo(() => data?.items ?? [], [data?.items]);
  const mediaAssets = data?.media ?? [];
  const filteredBlogItems = useMemo(
    () =>
      blogItems.filter((item) => {
        const matchesTag = activeTag ? (item.tags ?? []).includes(activeTag) : true;
        const matchesCategory = activeCategory ? normalizeCategoryList(item.category).includes(activeCategory) : true;
        return matchesTag && matchesCategory;
      }),
    [activeCategory, activeTag, blogItems]
  );

  const [featuredItem, ...secondaryItems] = filteredBlogItems;
  const blogPagination = usePublicPagination(secondaryItems, {
    pageSize: BLOG_PAGE_SIZE,
    resetKeys: [activeTag, activeCategory],
    scrollTargetId: "blog-list-heading"
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
      title="บทความ"
      description="บทความและเนื้อหาระยะยาวที่เผยแพร่จาก CMS"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
    >
      <PublicBackgroundProgress active={isFetching} />
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
          <Button href={normalizeSafeHref("/blog")} size="small">
            ล้างตัวกรอง
          </Button>
        </Stack>
      )}
      {featuredItem && (
        <PublicContentCard
          item={featuredItem}
          mediaAssets={mediaAssets}
          icon={<AutoStoriesOutlinedIcon sx={{ fontSize: 58 }} />}
          featured
        />
      )}
      {!filteredBlogItems.length && (
        <EmptyState
          title={hasActiveFilter ? "ไม่พบบทความตามตัวกรองที่เลือก" : "ยังไม่มีบทความที่เผยแพร่"}
          icon={<EditNoteOutlinedIcon />}
        />
      )}
      {!!secondaryItems.length && (
        <>
          <Stack
            id="blog-list-heading"
            direction="row"
            spacing={1.2}
            sx={{
              alignItems: "center",
              mt: 4,
              mb: 2
            }}
          >
            <EditNoteOutlinedIcon color="primary" />
            <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
              บทความล่าสุด
            </Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {blogPagination.paginatedItems.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <PublicContentCard
                  item={item}
                  mediaAssets={mediaAssets}
                  icon={<EditNoteOutlinedIcon sx={{ fontSize: 42 }} />}
                />
              </Grid>
            ))}
          </Grid>
          <PublicPagination
            page={blogPagination.page}
            pageCount={blogPagination.pageCount}
            pageSize={blogPagination.pageSize}
            totalItems={blogPagination.totalItems}
            onPageChange={(nextPage) => blogPagination.setPage(nextPage, { scroll: true })}
          />
        </>
      )}
    </PublicSiteShell>
  );
}
