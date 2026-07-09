import { useMemo } from "react";
import { Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicContentList } from "../hooks/usePublicContentList";
import { usePublicPagination } from "../hooks/usePublicPagination";
import { normalizeSafeHref } from "../../utils/safeUrl";

const ANNOUNCEMENTS_PAGE_SIZE = 12;
const PUBLIC_PAGES_PAGE_SIZE = 12;

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

export default function PublicAnnouncementsPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicContentList("announcements");
  const activeTag = readSearchParam("tag");
  const activeCategory = readSearchParam("category");
  const hasActiveFilter = Boolean(activeTag || activeCategory);
  const announcementItems = useMemo(() => data?.items ?? [], [data?.items]);
  const pageItems = useMemo(() => data?.pageItems ?? [], [data?.pageItems]);
  const mediaAssets = data?.media ?? [];
  const filteredAnnouncementItems = useMemo(
    () =>
      announcementItems.filter((item) => {
        const matchesTag = activeTag ? (item.tags ?? []).includes(activeTag) : true;
        const matchesCategory = activeCategory ? normalizeCategoryList(item.category).includes(activeCategory) : true;
        return matchesTag && matchesCategory;
      }),
    [activeCategory, activeTag, announcementItems]
  );
  const announcementsPagination = usePublicPagination(filteredAnnouncementItems, {
    pageSize: ANNOUNCEMENTS_PAGE_SIZE,
    queryParam: "announcementsPage",
    resetKeys: [activeTag, activeCategory],
    scrollTargetId: "announcements-list-heading"
  });
  const pagesPagination = usePublicPagination(pageItems, {
    pageSize: PUBLIC_PAGES_PAGE_SIZE,
    queryParam: "pagesPage",
    scrollTargetId: "public-pages-list-heading"
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
      title="ประกาศ"
      description="ประกาศราชการ ข้อมูลการรับสมัคร และเอกสารสาธารณะที่เผยแพร่โดยสถานศึกษา"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
    >
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
      <Stack id="announcements-list-heading" direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <CampaignOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ประกาศราชการ
        </Typography>
      </Stack>
      {hasActiveFilter && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ mb: 2 }}>
          {activeTag && <Chip label={`#${activeTag}`} color="secondary" />}
          {activeCategory && <Chip label={activeCategory} color="secondary" variant="outlined" />}
          <Button href={normalizeSafeHref("/announcements")} size="small">
            ล้างตัวกรอง
          </Button>
        </Stack>
      )}
      <Grid container spacing={2.5}>
        {announcementsPagination.paginatedItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard
              item={item}
              mediaAssets={mediaAssets}
              icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />}
            />
          </Grid>
        ))}
      </Grid>
      {filteredAnnouncementItems.length > 0 && (
        <PublicPagination
          page={announcementsPagination.page}
          pageCount={announcementsPagination.pageCount}
          pageSize={announcementsPagination.pageSize}
          totalItems={announcementsPagination.totalItems}
          onPageChange={(nextPage) => announcementsPagination.setPage(nextPage, { scroll: true })}
        />
      )}
      {!filteredAnnouncementItems.length && (
        <EmptyState
          title={hasActiveFilter ? "ไม่พบประกาศตามตัวกรองที่เลือก" : "ยังไม่มีประกาศที่เผยแพร่"}
          icon={<CampaignOutlinedIcon />}
        />
      )}

      <Stack id="public-pages-list-heading" direction="row" spacing={1.2} alignItems="center" sx={{ mt: 4, mb: 2 }}>
        <DescriptionOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          หน้าข้อมูลสาธารณะ
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {pagesPagination.paginatedItems.map((item) => (
          <Grid size={{ xs: 12, md: 6 }} key={item.id}>
            <PublicContentCard
              item={item}
              mediaAssets={mediaAssets}
              icon={<DescriptionOutlinedIcon sx={{ fontSize: 42 }} />}
            />
          </Grid>
        ))}
      </Grid>
      {pageItems.length > 0 && (
        <PublicPagination
          page={pagesPagination.page}
          pageCount={pagesPagination.pageCount}
          pageSize={pagesPagination.pageSize}
          totalItems={pagesPagination.totalItems}
          onPageChange={(nextPage) => pagesPagination.setPage(nextPage, { scroll: true })}
        />
      )}
      {!pageItems.length && <EmptyState title="ยังไม่มีเอกสารเผยแพร่" icon={<DescriptionOutlinedIcon />} />}
    </PublicSiteShell>
  );
}
