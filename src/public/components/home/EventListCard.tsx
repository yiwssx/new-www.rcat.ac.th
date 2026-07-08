import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import { CalendarEvent } from "../../../types";
import { formatDisplayDateTime } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

interface EventListCardProps {
  items: CalendarEvent[];
  limit?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyTitle?: string;
}

function EventDetail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography color="text.secondary" variant="caption" fontWeight={800}>
        {label}
      </Typography>
      <Typography>{value}</Typography>
    </Box>
  );
}

function getVisibleItems(items: CalendarEvent[], limit: number | undefined) {
  if (limit === undefined) {
    return items;
  }

  return items.slice(0, Math.max(0, Math.floor(limit)));
}

export function EventListCard({
  items,
  limit,
  viewAllHref,
  viewAllLabel = "ดูทั้งหมด",
  emptyTitle = "ยังไม่มีกิจกรรมที่เผยแพร่"
}: EventListCardProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const visibleItems = getVisibleItems(items, limit);

  return (
    <>
      <Card id="calendar" className="rcat-card h-full">
        <CardContent sx={{ p: 2.5 }}>
          <HomeSectionHeading label="กำหนดการ" title="กำหนดการ" />
          {visibleItems.length ? (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {visibleItems.map((event) => (
                <ButtonBase
                  key={event.id}
                  aria-label={`ดูรายละเอียด ${event.title}`}
                  onClick={() => setSelectedEvent(event)}
                  className="rcat-focus-ring"
                  sx={{ display: "block", width: "100%", textAlign: "left", borderRadius: 1.5 }}
                >
                  <Box className="py-3" sx={{ px: 0.5 }}>
                    <Typography fontWeight={900}>{event.title}</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.55 }}>
                      {formatDisplayDateTime(event.date)}
                    </Typography>
                    {event.location && (
                      <Typography color="text.secondary" variant="body2">
                        {event.location}
                      </Typography>
                    )}
                    <Typography color="primary.main" variant="caption" fontWeight={800}>
                      ดูรายละเอียด
                    </Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Stack>
          ) : (
            <EmptyState title={emptyTitle} icon={<EventAvailableOutlinedIcon />} />
          )}
          {viewAllHref && (
            <Button
              href={normalizeSafeHref(viewAllHref)}
              aria-label="ดูกำหนดการทั้งหมด"
              endIcon={<ArrowForwardOutlinedIcon />}
              sx={{ mt: 1.6 }}
              fullWidth
            >
              {viewAllLabel}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        aria-labelledby="public-event-detail-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="public-event-detail-title">{selectedEvent?.title}</DialogTitle>
        <DialogContent dividers>
          {selectedEvent && (
            <Stack spacing={1.5}>
              <EventDetail label="วันและเวลา" value={formatDisplayDateTime(selectedEvent.date)} />
              {selectedEvent.endDate && (
                <EventDetail label="สิ้นสุด" value={formatDisplayDateTime(selectedEvent.endDate)} />
              )}
              <EventDetail label="สถานที่" value={selectedEvent.location || "ไม่ระบุ"} />
              <EventDetail label="กลุ่มเป้าหมาย" value={selectedEvent.audience || "ไม่ระบุ"} />
              <EventDetail label="หมวดหมู่" value={selectedEvent.category || "ไม่ระบุ"} />
              <EventDetail label="สถานะ" value={selectedEvent.status || "ไม่ระบุ"} />
              <EventDetail label="การมองเห็น" value={selectedEvent.visibility || "public"} />
              <Box>
                <Typography color="text.secondary" variant="caption" fontWeight={800}>
                  รายละเอียด
                </Typography>
                <Typography sx={{ mt: 0.4, whiteSpace: "pre-wrap" }}>
                  {selectedEvent.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedEvent(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
