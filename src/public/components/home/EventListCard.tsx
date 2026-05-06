import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import { CalendarEvent } from "../../../types";
import { formatDisplayDateTime } from "../../../utils/dateDisplay";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function EventListCard({ items }: { items: CalendarEvent[] }) {
  return (
    <Card id="calendar" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="กำหนดการ" title="กำหนดการ" />
        {items.length ? (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {items.map((event) => (
              <Box key={event.id} sx={{ py: 1.35 }}>
                <Typography fontWeight={900}>{event.title}</Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mt: 0.55 }}>
                  {formatDisplayDateTime(event.date)}
                </Typography>
                {event.location && (
                  <Typography color="text.secondary" variant="body2">
                    {event.location}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        ) : (
          <EmptyState title="ยังไม่มีกิจกรรมที่เผยแพร่" icon={<EventAvailableOutlinedIcon />} />
        )}
      </CardContent>
    </Card>
  );
}
