import { LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicContentList } from "../hooks/usePublicContentList";

export default function PublicBlogPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList("blog");
  const blogItems = data?.items ?? [];
  const mediaAssets = data?.media ?? [];

  const [featuredItem, ...secondaryItems] = blogItems;

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell>
        <PublicLoadingState />
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
        <PublicLoadingState />
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
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
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
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
            <EditNoteOutlinedIcon color="primary" />
            <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
              บทความล่าสุด
            </Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {secondaryItems.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <PublicContentCard
                  item={item}
                  mediaAssets={mediaAssets}
                  icon={<EditNoteOutlinedIcon sx={{ fontSize: 42 }} />}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </PublicSiteShell>
  );
}
