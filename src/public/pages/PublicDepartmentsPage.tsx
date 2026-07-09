import { LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicPagination } from "../hooks/usePublicPagination";
import { usePublicProgramList } from "../hooks/usePublicProgramList";

const DEPARTMENTS_PAGE_SIZE = 12;

export default function PublicDepartmentsPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicProgramList();
  const programItems = data?.items ?? [];
  const mediaAssets = data?.media ?? [];
  const programsPagination = usePublicPagination(programItems, {
    pageSize: DEPARTMENTS_PAGE_SIZE,
    scrollTargetId: "departments-list-heading"
  });

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
      title="หลักสูตร"
      description="ข้อมูลหลักสูตรที่เผยแพร่จาก CMS"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
    >
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
      <Stack id="departments-list-heading" direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <SchoolOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ข้อมูลหลักสูตรที่เผยแพร่
        </Typography>
      </Stack>
      {programItems.length ? (
        <>
          <Grid container spacing={2.5}>
            {programsPagination.paginatedItems.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <PublicContentCard
                  item={item}
                  mediaAssets={mediaAssets}
                  icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />}
                />
              </Grid>
            ))}
          </Grid>
          <PublicPagination
            page={programsPagination.page}
            pageCount={programsPagination.pageCount}
            pageSize={programsPagination.pageSize}
            totalItems={programsPagination.totalItems}
            onPageChange={(nextPage) => programsPagination.setPage(nextPage, { scroll: true })}
          />
        </>
      ) : (
        <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
      )}
    </PublicSiteShell>
  );
}
