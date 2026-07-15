import { useMemo } from "react";
import { LinearProgress, Stack, Typography } from "@mui/material";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import type { CalendarEvent } from "../../types";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { EventListCard } from "../components/home/EventListCard";
import { usePublicPagination } from "../hooks/usePublicPagination";
import { usePublicEventList } from "../hooks/usePublicEventList";

const CALENDAR_PAGE_SIZE = 12;

function compareEventDate(left: CalendarEvent, right: CalendarEvent) {
  const leftTime = Date.parse(left.date);
  const rightTime = Date.parse(right.date);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return (
    right.date.localeCompare(left.date) || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
}

function isPublicConfirmedEvent(event: CalendarEvent) {
  return event.status === "confirmed" && (event.visibility ?? "public") === "public";
}

export default function PublicCalendarPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicEventList();
  const events = useMemo(
    () => [...(data?.items ?? [])].filter(isPublicConfirmedEvent).sort(compareEventDate),
    [data?.items]
  );
  const eventsPagination = usePublicPagination(events, {
    pageSize: CALENDAR_PAGE_SIZE,
    scrollTargetId: "calendar-list-heading"
  });

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell title="กำหนดการ" description="กำหนดการและกิจกรรมที่เผยแพร่ของสถานศึกษา">
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
      <PublicSiteShell title="กำหนดการ" description="กำหนดการและกิจกรรมที่เผยแพร่ของสถานศึกษา">
        <PublicLoadingState />
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell
      title="กำหนดการ"
      description="รวมกำหนดการ กิจกรรม และวันสำคัญที่เปิดเผยต่อสาธารณะ"
      seoTitle="กำหนดการ"
      seoDescription="กำหนดการและกิจกรรมสาธารณะของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด"
      canonicalPath="/calendar"
    >
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
      <Stack id="calendar-list-heading" direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <EventAvailableOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          กำหนดการทั้งหมด
        </Typography>
      </Stack>
      <EventListCard
        items={eventsPagination.paginatedItems}
        mediaAssets={data.media}
        emptyTitle="ยังไม่มีกำหนดการเผยแพร่"
      />
      {events.length > 0 && (
        <PublicPagination
          page={eventsPagination.page}
          pageCount={eventsPagination.pageCount}
          pageSize={eventsPagination.pageSize}
          totalItems={eventsPagination.totalItems}
          onPageChange={(nextPage) => eventsPagination.setPage(nextPage, { scroll: true })}
        />
      )}
    </PublicSiteShell>
  );
}
