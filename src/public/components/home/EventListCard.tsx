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
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import { CalendarEvent } from "../../../types";
import { formatDisplayDateTime } from "../../../utils/dateDisplay";
import { HomeSectionHeading } from "./HomeSectionHeading";

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

export function EventListCard({ items }: { items: CalendarEvent[] }) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  return (
    <>
      <Card id="calendar" className="rcat-card h-full">
        <CardContent sx={{ p: 2.5 }}>
          <HomeSectionHeading label="กำหนดการ" title="กำหนดการ" />
          {items.length ? (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {items.map((event) => (
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
            <EmptyState title="ยังไม่มีกิจกรรมที่เผยแพร่" icon={<EventAvailableOutlinedIcon />} />
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
