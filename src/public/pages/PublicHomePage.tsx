import { ReactNode, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import FaxOutlinedIcon from "@mui/icons-material/FaxOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import dayjs from "dayjs";
import EmptyState from "../../shared/components/EmptyState";
import { normalizeSiteSettings } from "../../services/siteSettings";
import { CalendarEvent, ContentItem, SiteSettings } from "../../types";
import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateDisplay";
import { normalizeSafeHref, normalizeSafeResourceUrl } from "../../utils/safeUrl";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";

interface HomeSectionHeadingProps {
  label: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

const documentKeywords = ["เอกสาร", "document", "ita", "แผนงาน", "ประกันคุณภาพ"];

const focusVisibleSx = {
  "&:focus-visible": {
    outline: "3px solid",
    outlineColor: "secondary.main",
    outlineOffset: 3
  }
};

function HomeSectionHeading({ label, title, description, action }: HomeSectionHeadingProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      sx={{ mb: 2.5 }}
    >
      <Stack spacing={0.75}>
        <Typography
          component="p"
          sx={{
            color: "secondary.dark",
            fontSize: "0.78rem",
            fontWeight: 800,
            letterSpacing: 0,
            textTransform: "uppercase"
          }}
        >
          :: {label}
        </Typography>
        <Typography variant="h2">{title}</Typography>
        {description && (
          <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
            {description}
          </Typography>
        )}
      </Stack>
      {action}
    </Stack>
  );
}

function getPublishDateValue(item: ContentItem) {
  const date = dayjs(item.publishAt);
  return date.isValid() ? date.valueOf() : 0;
}

function sortByPublishDate(items: ContentItem[]) {
  return [...items].sort((left, right) => getPublishDateValue(right) - getPublishDateValue(left));
}

function getEventDateValue(event: CalendarEvent) {
  const date = dayjs(event.date);
  return date.isValid() ? date.valueOf() : Number.POSITIVE_INFINITY;
}

function sortEventsByUpcomingDate(events: CalendarEvent[]) {
  const today = dayjs().startOf("day").valueOf();

  return [...events].sort((left, right) => {
    const leftDate = getEventDateValue(left);
    const rightDate = getEventDateValue(right);
    const leftUpcoming = leftDate >= today;
    const rightUpcoming = rightDate >= today;

    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    return leftUpcoming ? leftDate - rightDate : rightDate - leftDate;
  });
}

function hasContentKeyword(item: ContentItem, keywords: string[]) {
  const haystack = [item.category, ...(item.tags ?? [])].join(" ").toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function CompactAnnouncementList({ items, emptyTitle }: { items: ContentItem[]; emptyTitle: string }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} icon={<CampaignOutlinedIcon />} />;
  }

  return (
    <Stack divider={<Divider flexItem />} spacing={0}>
      {items.map((item) => (
        <Box
          key={item.id}
          component="a"
          href={normalizeSafeHref(`/content/${item.slug}`)}
          aria-label={`อ่านประกาศ ${item.title}`}
          sx={{
            display: "block",
            py: 1.45,
            px: 0.5,
            borderRadius: 1.5,
            ...focusVisibleSx
          }}
        >
          <Stack spacing={0.8}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip label="ประกาศ" size="small" color={item.featured ? "secondary" : "default"} />
              {item.category && <Chip label={item.category} size="small" variant="outlined" />}
            </Stack>
            <Typography fontWeight={900}>{item.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {formatDisplayDate(item.publishAt)}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function LatestAnnouncementsCard({ items }: { items: ContentItem[] }) {
  return (
    <Card id="announcements" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading
          label="ประกาศ"
          title="ประกาศล่าสุด"
          action={
            <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />}>
              ทั้งหมด
            </Button>
          }
        />
        <CompactAnnouncementList items={items} emptyTitle="ยังไม่มีประกาศที่เผยแพร่" />
      </CardContent>
    </Card>
  );
}

function DocumentListCard({ items }: { items: ContentItem[] }) {
  return (
    <Card id="documents" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="เอกสาร" title="เอกสารเผยแพร่" />
        {items.length ? (
          <Stack spacing={1.1}>
            {items.map((item) => (
              <Box
                key={item.id}
                component="a"
                href={normalizeSafeHref(`/content/${item.slug}`)}
                aria-label={`อ่านเอกสาร ${item.title}`}
                sx={{
                  p: 1.5,
                  display: "block",
                  borderRadius: 2,
                  bgcolor: "background.default",
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  ...focusVisibleSx
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <DescriptionOutlinedIcon sx={{ color: "primary.main", mt: 0.2 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800}>{item.title}</Typography>
                    {item.category && (
                      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.45 }}>
                        {item.category}
                      </Typography>
                    )}
                  </Box>
                  <NavigateNextRoundedIcon sx={{ color: "text.secondary" }} />
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <EmptyState title="ยังไม่มีเอกสารเผยแพร่" icon={<DescriptionOutlinedIcon />} />
        )}
      </CardContent>
    </Card>
  );
}

function EventListCard({ items }: { items: CalendarEvent[] }) {
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

function ContactMapCard({ siteSettings }: { siteSettings: SiteSettings }) {
  const hasContactInfo = Boolean(
    siteSettings.campus || siteSettings.address || siteSettings.phone || siteSettings.fax || siteSettings.email
  );
  const mapEmbedSrc = normalizeSafeResourceUrl(siteSettings.mapEmbedUrl);
  const mapHref = normalizeSafeHref(siteSettings.mapUrl);

  if (!hasContactInfo && !mapEmbedSrc && mapHref === "#") {
    return null;
  }

  return (
    <Card component="section" id="contact" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <HomeSectionHeading label="ติดต่อ" title="ติดต่อและแผนที่" />
        {hasContactInfo && (
          <Stack spacing={1.15} sx={{ mb: mapEmbedSrc ? 1.8 : 0 }}>
            {(siteSettings.campus || siteSettings.address) && (
              <Stack direction="row" spacing={1.1} alignItems="flex-start">
                <LocationOnOutlinedIcon color="primary" fontSize="small" sx={{ mt: 0.2, flexShrink: 0 }} />
                <Typography
                  color="text.secondary"
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-line",
                    lineHeight: 1.55,
                    minWidth: 0
                  }}
                >
                  {[siteSettings.campus, siteSettings.address].filter(Boolean).join("\n")}
                </Typography>
              </Stack>
            )}

            {(siteSettings.phone || siteSettings.fax) && (
              <Stack direction={{ xs: "row", sm: "row" }} spacing={1.4} useFlexGap flexWrap="wrap" alignItems="center">
                {siteSettings.phone && (
                  <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0, flex: "0 1 auto" }}>
                    <LocalPhoneOutlinedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                    <Typography color="text.secondary" variant="body2" noWrap>
                      {siteSettings.phone}
                    </Typography>
                  </Stack>
                )}

                {siteSettings.fax && (
                  <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0, flex: "0 1 auto" }}>
                    <FaxOutlinedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                    <Typography color="text.secondary" variant="body2" noWrap>
                      {siteSettings.fax}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            )}

            {siteSettings.email && (
              <Stack direction="row" spacing={1.1} alignItems="center">
                <MailOutlineRoundedIcon color="primary" fontSize="small" sx={{ flexShrink: 0 }} />
                <Typography
                  color="text.secondary"
                  variant="body2"
                  sx={{
                    minWidth: 0,
                    overflowWrap: "anywhere"
                  }}
                >
                  {siteSettings.email}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}
        {mapEmbedSrc && (
          <Box
            component="iframe"
            src={mapEmbedSrc}
            title="แผนที่วิทยาลัย"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sx={{
              width: "100%",
              height: { xs: 190, md: 210 },
              border: 0,
              borderRadius: 2,
              display: "block",
              mt: hasContactInfo ? 1.2 : 0
            }}
          />
        )}
        {mapHref !== "#" && (
          <Button
            component="a"
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            variant={mapEmbedSrc ? "text" : "outlined"}
            startIcon={<MapOutlinedIcon />}
            endIcon={<OpenInNewOutlinedIcon />}
            fullWidth
            aria-label="เปิดแผนที่ใน Google Maps"
            sx={{
              justifyContent: "space-between",
              mt: mapEmbedSrc || hasContactInfo ? 1 : 0,
              ...focusVisibleSx
            }}
          >
            เปิดใน Google Maps
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DirectorHeroCard({ siteSettings }: { siteSettings: SiteSettings }) {
  const hasDirectorInfo = Boolean(
    siteSettings.directorName ||
    siteSettings.directorDescription ||
    siteSettings.directorTitle ||
    siteSettings.directorImageUrl
  );
  const directorImageAlt = siteSettings.directorName
    ? `รูปผู้บริหาร ${siteSettings.directorName}`
    : "รูปผู้บริหารสถานศึกษา";

  return (
    <Card component="section" sx={{ borderTop: "5px solid", borderColor: "secondary.main" }}>
      <CardContent sx={{ p: { xs: 1.75, md: 2 }, textAlign: "center" }}>
        <Box sx={{ mb: 1.25 }}>
          <Typography
            component="p"
            sx={{
              color: "secondary.dark",
              fontSize: "0.72rem",
              fontWeight: 800,
              letterSpacing: 0,
              textTransform: "uppercase"
            }}
          >
            :: ผู้บริหารสถานศึกษา
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: "1.05rem", md: "1.15rem" } }}>
            {siteSettings.directorTitle || "ข้อมูลผู้บริหาร"}
          </Typography>
        </Box>
        {hasDirectorInfo ? (
          <Stack spacing={1}>
            {siteSettings.directorImageUrl ? (
              <Box
                component="img"
                src={normalizeSafeHref(siteSettings.directorImageUrl)}
                alt={directorImageAlt}
                sx={{
                  width: "100%",
                  maxWidth: { xs: 112, sm: 120, md: 128, lg: 136 },
                  mx: "auto",
                  aspectRatio: "3 / 4",
                  borderRadius: 2,
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                  bgcolor: "background.default"
                }}
              />
            ) : (
              <Box
                sx={(theme) => ({
                  width: "100%",
                  maxWidth: { xs: 112, sm: 120, md: 128, lg: 136 },
                  mx: "auto",
                  aspectRatio: "3 / 4",
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.primary.light, 0.82)
                })}
              >
                <SchoolOutlinedIcon sx={{ fontSize: { xs: 42, md: 48 }, color: "primary.dark" }} />
              </Box>
            )}
            <Stack spacing={0.45}>
              {siteSettings.directorName && (
                <Typography variant="h3" sx={{ fontSize: { xs: "0.98rem", md: "1.05rem" }, fontWeight: 900 }}>
                  {siteSettings.directorName}
                </Typography>
              )}
              {siteSettings.directorDescription && (
                <Typography color="text.secondary" sx={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
                  {siteSettings.directorDescription}
                </Typography>
              )}
            </Stack>
          </Stack>
        ) : (
          <EmptyState title="ยังไม่มีข้อมูลผู้บริหาร" icon={<SchoolOutlinedIcon />} />
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicHomePage() {
  const { data, isFetching } = usePublicCmsSnapshot();
  const publicContent = useMemo(
    () => sortByPublishDate((data?.content ?? []).filter((item) => item.status === "published")),
    [data]
  );
  const announcementContent = publicContent.filter((item) => item.type === "announcement");
  const latestNews = publicContent.filter((item) => item.type === "news" || item.type === "blog").slice(0, 4);
  const latestAnnouncements = announcementContent.slice(0, 5);
  const programItems = publicContent.filter((item) => item.type === "program").slice(0, 6);
  const documentItems = publicContent
    .filter((item) => item.type === "page" && hasContentKeyword(item, documentKeywords))
    .slice(0, 6);
  const eventItems = sortEventsByUpcomingDate(
    (data?.events ?? []).filter((event) => event.status === "confirmed" && (event.visibility ?? "public") === "public")
  ).slice(0, 4);

  if (!data) {
    return (
      <PublicSiteShell hidePageHeader disableMainContainer canonicalPath="/">
        {null}
      </PublicSiteShell>
    );
  }

  const siteSettings = normalizeSiteSettings(data.siteSettings);
  const heroImageLayer = siteSettings.heroImageUrl ? `, url(${JSON.stringify(siteSettings.heroImageUrl)})` : "";

  return (
    <PublicSiteShell
      hidePageHeader
      disableMainContainer
      seoDescription={siteSettings.heroDescription || siteSettings.intro}
      canonicalPath="/"
    >
      {isFetching && <LinearProgress />}
      <Container maxWidth="xl">
        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 8 }}>
            <Box
              component="section"
              sx={(theme) => ({
                position: "relative",
                overflow: "hidden",
                borderRadius: 3,
                minHeight: { xs: 320, sm: 340, md: 420 },
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                p: { xs: 2.5, md: 4.5 },
                color: "white",
                backgroundImage: `linear-gradient(120deg, ${alpha(theme.palette.primary.dark, 0.94)} 0%, ${alpha(theme.palette.primary.main, 0.82)} 52%, ${alpha(theme.palette.secondary.dark, 0.68)} 100%)${heroImageLayer}`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 22px 42px rgba(31, 90, 44, 0.18)"
              })}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(12, 34, 14, 0.08) 0%, rgba(12, 34, 14, 0.55) 100%)"
                }}
              />
              <Stack spacing={2.1} sx={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
                {siteSettings.heroChip && (
                  <Chip
                    icon={<SchoolOutlinedIcon />}
                    label={siteSettings.heroChip}
                    sx={{
                      alignSelf: "flex-start",
                      bgcolor: "rgba(255, 255, 255, 0.14)",
                      color: "white",
                      border: "1px solid rgba(255, 255, 255, 0.22)"
                    }}
                  />
                )}
                <Typography variant="h1" sx={{ fontSize: { xs: "2rem", md: "3.6rem" }, lineHeight: 1.04 }}>
                  {siteSettings.heroTitle}
                </Typography>
                {siteSettings.heroDescription && (
                  <Typography sx={{ maxWidth: 620, color: "rgba(255, 255, 255, 0.84)" }}>
                    {siteSettings.heroDescription}
                  </Typography>
                )}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.2}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  {siteSettings.admissionUrl && (
                    <Button
                      variant="contained"
                      color="secondary"
                      size="large"
                      href={normalizeSafeHref(siteSettings.admissionUrl)}
                      startIcon={<AssignmentIcon />}
                    >
                      สมัครเรียน
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    size="large"
                    href={normalizeSafeHref("/announcements")}
                    sx={{
                      color: "white",
                      borderColor: "rgba(255, 255, 255, 0.34)"
                    }}
                  >
                    ประกาศ
                  </Button>
                  <Button
                    variant="text"
                    size="large"
                    href={normalizeSafeHref("/news")}
                    endIcon={<ArrowForwardOutlinedIcon />}
                    sx={{ color: "white" }}
                  >
                    ข่าวสาร
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <DirectorHeroCard siteSettings={siteSettings} />
          </Grid>
        </Grid>

        <Box component="section" id="news" sx={{ mt: { xs: 4, md: 5.5 } }}>
          <Grid container spacing={3.2} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 8 }}>
              <HomeSectionHeading
                label="ข่าวสาร"
                title="ข่าวสารและกิจกรรมล่าสุด"
                action={
                  <Button href={normalizeSafeHref("/news")} endIcon={<ArrowForwardOutlinedIcon />}>
                    ข่าวทั้งหมด
                  </Button>
                }
              />
              {latestNews.length ? (
                <Grid container spacing={2.5}>
                  {latestNews.map((item) => (
                    <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                      <PublicContentCard
                        item={item}
                        mediaAssets={data?.media ?? []}
                        icon={<CampaignOutlinedIcon sx={{ fontSize: 42 }} />}
                      />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <EmptyState title="ยังไม่มีข่าวที่เผยแพร่" icon={<ArticleOutlinedIcon />} />
              )}

              <Box component="section" id="departments" sx={{ mt: { xs: 4, md: 5.5 } }}>
                <HomeSectionHeading label="หลักสูตร" title="หลักสูตรที่เปิดสอน" />
                {programItems.length ? (
                  <Grid container spacing={2.5}>
                    {programItems.map((item) => (
                      <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                        <PublicContentCard
                          item={item}
                          mediaAssets={data?.media ?? []}
                          icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />}
                        />
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <EmptyState title="ยังไม่มีข้อมูลหลักสูตรที่เผยแพร่" icon={<SchoolOutlinedIcon />} />
                )}
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={2.5}>
                <LatestAnnouncementsCard items={latestAnnouncements} />
                <EventListCard items={eventItems} />
                <DocumentListCard items={documentItems} />
                <ContactMapCard siteSettings={siteSettings} />
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </PublicSiteShell>
  );
}
