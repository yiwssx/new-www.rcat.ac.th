import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import EmptyState from "../../shared/components/EmptyState";
import type { ContentItem } from "../../types";
import PublicContentCard from "../components/PublicContentCard";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState, { PublicBackgroundProgress } from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicPagination } from "../hooks/usePublicPagination";
import { usePublicSearchIndex } from "../hooks/usePublicSearchIndex";

const ACHIEVEMENTS_PAGE_SIZE = 12;
const ACHIEVEMENT_PATTERN = /achievement|award|รางวัล|ผลงาน|ความสำเร็จ|ความภาคภูมิใจ|ชนะเลิศ|รองชนะเลิศ|เหรียญ/i;

function getAchievementHaystack(item: ContentItem) {
  return [item.title, item.summary, item.category, ...(item.tags ?? [])].join(" ");
}

function isAchievementItem(item: ContentItem) {
  return item.status === "published" && ACHIEVEMENT_PATTERN.test(getAchievementHaystack(item));
}

function compareContentPublishAtDesc(left: ContentItem, right: ContentItem) {
  const leftTime = Date.parse(left.publishAt);
  const rightTime = Date.parse(right.publishAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(right.publishAt || "").localeCompare(String(left.publishAt || "")) || right.id.localeCompare(left.id);
}

export default function PublicAchievementsPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicSearchIndex();
  const achievementItems = useMemo(
    () => [...(data?.items ?? [])].filter(isAchievementItem).sort(compareContentPublishAtDesc),
    [data?.items]
  );
  const achievementsPagination = usePublicPagination(achievementItems, {
    pageSize: ACHIEVEMENTS_PAGE_SIZE,
    scrollTargetId: "achievements-list-heading"
  });

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell title="ผลงานและความภาคภูมิใจ" description="รวมผลงาน รางวัล และความสำเร็จของสถานศึกษา">
        <PublicLoadingState variant="card-grid" />
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
      <PublicSiteShell title="ผลงานและความภาคภูมิใจ" description="รวมผลงาน รางวัล และความสำเร็จของสถานศึกษา">
        <PublicLoadingState variant="card-grid" />
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell
      title="ผลงานและความภาคภูมิใจ"
      description="รวมผลงาน รางวัล และความสำเร็จของนักเรียนนักศึกษา ครู บุคลากร และสถานศึกษา"
      seoTitle="ผลงานและความภาคภูมิใจ"
      seoDescription="ผลงาน รางวัล และความสำเร็จของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด"
      canonicalPath="/achievements"
      preloadedSiteSettings={data.siteSettings}
      preloadedHomepageSettings={data.homepageSettings}
      preloadedDisplaySettings={data.displaySettings}
      preloadedMenu={data.menu}
    >
      <PublicBackgroundProgress active={isFetching} />
      <Stack id="achievements-list-heading" direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <EmojiEventsOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          ผลงานทั้งหมด
        </Typography>
      </Stack>
      {achievementItems.length ? (
        <>
          <Grid container spacing={2.5}>
            {achievementsPagination.paginatedItems.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <PublicContentCard item={item} icon={<EmojiEventsOutlinedIcon sx={{ fontSize: 42 }} />} />
              </Grid>
            ))}
          </Grid>
          <PublicPagination
            page={achievementsPagination.page}
            pageCount={achievementsPagination.pageCount}
            pageSize={achievementsPagination.pageSize}
            totalItems={achievementsPagination.totalItems}
            onPageChange={(nextPage) => achievementsPagination.setPage(nextPage, { scroll: true })}
          />
        </>
      ) : (
        <EmptyState title="ยังไม่มีผลงานที่เผยแพร่" icon={<EmojiEventsOutlinedIcon />} />
      )}
    </PublicSiteShell>
  );
}
