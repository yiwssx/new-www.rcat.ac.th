import { Stack, Typography } from "@mui/material";
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

const BLOG_PAGE_SIZE = 12;

export default function PublicBlogPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList("blog");
  const blogItems = data?.items ?? [];
  const mediaAssets = data?.media ?? [];

  const [featuredItem, ...secondaryItems] = blogItems;
  const blogPagination = usePublicPagination(secondaryItems, {
    pageSize: BLOG_PAGE_SIZE,
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
      {featuredItem && (
        <PublicContentCard
          item={featuredItem}
          mediaAssets={mediaAssets}
          icon={<AutoStoriesOutlinedIcon sx={{ fontSize: 58 }} />}
          featured
        />
      )}
      {!blogItems.length && <EmptyState title="ยังไม่มีบทความที่เผยแพร่" icon={<EditNoteOutlinedIcon />} />}
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
