import { LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicProgramList } from "../hooks/usePublicProgramList";

export default function PublicDepartmentsPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicProgramList();
  const programItems = data?.items ?? [];
  const mediaAssets = data?.media ?? [];

  if (!data && (isLoading || isFetching)) {
    return <PublicLoadingState />;
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
    return <PublicLoadingState />;
  }

  return (
    <PublicSiteShell
      title="หลักสูตร"
      description="ข้อมูลหลักสูตรที่เผยแพร่จาก CMS"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
    >
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <SchoolOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ข้อมูลหลักสูตรที่เผยแพร่
        </Typography>
      </Stack>
      {programItems.length ? (
        <Grid container spacing={2.5}>
          {programItems.map((item) => (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <PublicContentCard
                item={item}
                mediaAssets={mediaAssets}
                icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
      )}
    </PublicSiteShell>
  );
}
