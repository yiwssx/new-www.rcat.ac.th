import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import EmptyState from "../../../shared/components/EmptyState";
import {
  EVENT_LIFECYCLE_LABELS,
  formatEventDateTimeRange,
  getEventLifecycle
} from "../../../features/cms-events/presentation";
import type { CalendarEvent, MediaAsset } from "../../../types";
import { normalizePublicImageUrl, normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

interface EventListCardProps {
  items: CalendarEvent[];
  mediaAssets?: MediaAsset[];
  limit?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyTitle?: string;
}

interface EventDetailProps {
  label: string;
  value: string;
}

function EventDetail({ label, value }: EventDetailProps) {
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

function getMediaHref(asset: MediaAsset) {
  return normalizeSafeHref(asset.driveUrl || asset.previewUrl || asset.embedUrl || "");
}

function getMediaImageUrl(asset: MediaAsset) {
  return normalizePublicImageUrl(asset.thumbnailUrl || asset.previewUrl || asset.driveUrl || "");
}

function EventImageAttachment({ asset }: { asset: MediaAsset }) {
  const imageUrl = getMediaImageUrl(asset);
  const href = getMediaHref(asset);

  if (!imageUrl) {
    return null;
  }

  const content = (
    <>
      <Box
        component="img"
        src={imageUrl}
        alt={asset.name}
        loading="lazy"
        decoding="async"
        sx={{
          width: "100%",
          height: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          display: "block",
          bgcolor: "background.default"
        }}
      />

      <Typography
        variant="body2"
        fontWeight={800}
        sx={{
          p: 1.25,
          overflowWrap: "anywhere"
        }}
      >
        {asset.name}
      </Typography>
    </>
  );

  const sharedSx = {
    display: "block",
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
    border: "1px solid",
    borderColor: "divider",
    bgcolor: "background.paper",
    color: "text.primary",
    textDecoration: "none",
    transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    "&:hover": {
      transform: href !== "#" ? "translateY(-2px)" : "none",
      boxShadow: href !== "#" ? 3 : 0,
      borderColor: href !== "#" ? "primary.main" : "divider"
    },
    "&:focus-visible": {
      outline: "3px solid",
      outlineColor: "primary.light",
      outlineOffset: 2
    }
  };

  if (href === "#") {
    return <Box sx={sharedSx}>{content}</Box>;
  }

  return (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`เปิดรูปภาพ ${asset.name}`}
      sx={sharedSx}
    >
      {content}
    </Box>
  );
}

function EventOtherAttachment({ asset }: { asset: MediaAsset }) {
  const href = getMediaHref(asset);

  if (href === "#") {
    return (
      <Button
        disabled
        variant="outlined"
        fullWidth
        sx={{
          justifyContent: "flex-start",
          textAlign: "left"
        }}
      >
        {asset.name}
      </Button>
    );
  }

  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      variant="outlined"
      fullWidth
      sx={{
        justifyContent: "flex-start",
        textAlign: "left",
        overflowWrap: "anywhere"
      }}
    >
      {asset.name}
    </Button>
  );
}

export function EventListCard({
  items,
  mediaAssets = [],
  limit,
  viewAllHref,
  viewAllLabel = "ดูทั้งหมด",
  emptyTitle = "ยังไม่มีกิจกรรมที่เผยแพร่"
}: EventListCardProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const updateNow = () => {
      setNowMs(Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateNow();
      }
    };

    const intervalId = window.setInterval(updateNow, 30_000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const visibleItems = getVisibleItems(items, limit);

  const mediaById = useMemo(() => new Map(mediaAssets.map((asset) => [asset.id, asset])), [mediaAssets]);

  const selectedEventMedia = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    return (selectedEvent.mediaIds ?? [])
      .map((id) => mediaById.get(id))
      .filter((asset): asset is MediaAsset => Boolean(asset));
  }, [mediaById, selectedEvent]);

  const selectedImages = useMemo(
    () => selectedEventMedia.filter((asset) => asset.type === "image"),
    [selectedEventMedia]
  );

  const selectedOtherMedia = useMemo(
    () => selectedEventMedia.filter((asset) => asset.type !== "image"),
    [selectedEventMedia]
  );

  const selectedLifecycle = selectedEvent ? getEventLifecycle(selectedEvent, nowMs) : null;

  const safeViewAllHref = viewAllHref ? normalizeSafeHref(viewAllHref) : "#";

  return (
    <>
      <Card id="calendar" className="rcat-card h-full">
        <CardContent sx={{ p: 2.5 }}>
          <HomeSectionHeading label="กำหนดการ" title="กำหนดการ" />

          {visibleItems.length ? (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {visibleItems.map((event) => {
                const lifecycle = getEventLifecycle(event, nowMs);

                return (
                  <ButtonBase
                    key={event.id}
                    aria-label={`ดูรายละเอียด ${event.title}`}
                    onClick={() => setSelectedEvent(event)}
                    className="rcat-focus-ring"
                    sx={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      borderRadius: 1.5
                    }}
                  >
                    <Box className="py-3" sx={{ px: 0.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography fontWeight={900}>{event.title}</Typography>

                        <Chip
                          label={EVENT_LIFECYCLE_LABELS[lifecycle]}
                          size="small"
                          variant="outlined"
                          className={`rcat-event-status-chip ` + `rcat-event-status-${lifecycle}`}
                        />
                      </Stack>

                      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
                        {formatEventDateTimeRange(event)}
                      </Typography>

                      {event.location && (
                        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25 }}>
                          {event.location}
                        </Typography>
                      )}

                      <Typography
                        color="primary.main"
                        variant="caption"
                        fontWeight={800}
                        sx={{
                          display: "inline-block",
                          mt: 0.5
                        }}
                      >
                        ดูรายละเอียด
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
            </Stack>
          ) : (
            <EmptyState title={emptyTitle} icon={<EventAvailableOutlinedIcon />} />
          )}

          {viewAllHref && safeViewAllHref !== "#" && (
            <Button
              href={safeViewAllHref}
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
        maxWidth="md"
      >
        <DialogTitle id="public-event-detail-title">{selectedEvent?.title}</DialogTitle>

        <DialogContent dividers>
          {selectedEvent && selectedLifecycle && (
            <Stack spacing={2}>
              <EventDetail
                label={"วันเวลาเริ่มต้น - " + "วันเวลาสิ้นสุด"}
                value={formatEventDateTimeRange(selectedEvent)}
              />

              <Box>
                <Typography color="text.secondary" variant="caption" fontWeight={800}>
                  สถานะกิจกรรม
                </Typography>

                <Box sx={{ mt: 0.75 }}>
                  <Chip
                    label={EVENT_LIFECYCLE_LABELS[selectedLifecycle]}
                    variant="outlined"
                    className={`rcat-event-status-chip ` + `rcat-event-status-${selectedLifecycle}`}
                  />
                </Box>
              </Box>

              <EventDetail label="สถานที่" value={selectedEvent.location || "ไม่ระบุ"} />

              <EventDetail label="กลุ่มเป้าหมาย" value={selectedEvent.audience || "ไม่ระบุ"} />

              <EventDetail label="หมวดหมู่" value={selectedEvent.category || "ไม่ระบุ"} />

              <Box>
                <Typography color="text.secondary" variant="caption" fontWeight={800}>
                  รายละเอียด
                </Typography>

                <Typography
                  sx={{
                    mt: 0.4,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere"
                  }}
                >
                  {selectedEvent.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                </Typography>
              </Box>

              {selectedImages.length > 0 && (
                <Box>
                  <Typography color="text.secondary" variant="caption" fontWeight={800}>
                    รูปภาพกิจกรรม
                  </Typography>

                  <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                    {selectedImages.map((asset) => (
                      <Grid
                        size={{
                          xs: 12,
                          sm: 6
                        }}
                        key={asset.id}
                      >
                        <EventImageAttachment asset={asset} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {selectedOtherMedia.length > 0 && (
                <Stack spacing={0.75}>
                  <Typography color="text.secondary" variant="caption" fontWeight={800}>
                    สื่อและเอกสารแนบ
                  </Typography>

                  {selectedOtherMedia.map((asset) => (
                    <EventOtherAttachment key={asset.id} asset={asset} />
                  ))}
                </Stack>
              )}
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
