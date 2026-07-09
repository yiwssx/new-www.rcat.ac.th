import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import { ContentItem } from "../../../types";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

function getAchievementHaystack(item: ContentItem) {
  return [item.title, item.summary, item.category, ...(item.tags ?? [])].join(" ").toLowerCase();
}

function getAchievementIcon(item: ContentItem) {
  const haystack = getAchievementHaystack(item);

  if (haystack.includes("นวัตกรรม") || haystack.includes("innovation")) {
    return <AutoAwesomeOutlinedIcon />;
  }

  if (haystack.includes("ทวิภาคี") || haystack.includes("cooperation") || haystack.includes("ความร่วมมือ")) {
    return <GroupsOutlinedIcon />;
  }

  if (haystack.includes("ครู") || haystack.includes("บุคลากร")) {
    return <EmojiEventsOutlinedIcon />;
  }

  return <WorkspacePremiumOutlinedIcon />;
}

function getThaiYear(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return String(date.getFullYear() + 543);
}

function getAchievementCategory(item: ContentItem) {
  return item.category || item.tags?.[0] || "ผลงาน";
}

function compareContentPublishAtDesc(left: ContentItem, right: ContentItem) {
  const leftTime = Date.parse(left.publishAt);
  const rightTime = Date.parse(right.publishAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(right.publishAt || "").localeCompare(String(left.publishAt || "")) || right.id.localeCompare(left.id);
}

function getVisibleItems(items: ContentItem[], limit: number | undefined) {
  const sortedItems = [...items].sort(compareContentPublishAtDesc);

  if (limit === undefined) {
    return sortedItems;
  }

  return sortedItems.slice(0, Math.max(0, Math.floor(limit)));
}

interface AchievementHighlightsSectionProps {
  items: ContentItem[];
  limit?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
}

export function AchievementHighlightsSection({
  items,
  limit = 6,
  viewAllHref,
  viewAllLabel = "ดูผลงานทั้งหมด"
}: AchievementHighlightsSectionProps) {
  const visibleItems = getVisibleItems(items, limit);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="ความสำเร็จ"
        title="ผลงานและความภาคภูมิใจ"
        description="รวมผลงานเด่น รางวัล และความภาคภูมิใจของนักเรียนนักศึกษา ครู บุคลากร และสถานศึกษา"
      />
      <Grid container spacing={2.5}>
        {visibleItems.map((item) => {
          const thaiYear = getThaiYear(item.publishAt);
          const href = normalizeSafeHref(`/content/${item.slug}`);

          return (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <Card
                component="a"
                href={href}
                aria-label={`อ่านผลงาน ${item.title}`}
                sx={{
                  display: "block",
                  height: "100%",
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  boxShadow: "0 12px 28px rgba(31, 90, 44, 0.08)",
                  color: "inherit",
                  textDecoration: "none",
                  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  "&:hover, &:focus-visible": {
                    borderColor: "primary.main",
                    boxShadow: "0 16px 32px rgba(31, 90, 44, 0.12)",
                    transform: "translateY(-2px)"
                  }
                }}
              >
                <CardContent
                  sx={{
                    height: "100%",
                    p: 2.25,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.4
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                    <Box
                      sx={(theme) => ({
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        color: "primary.dark",
                        bgcolor: alpha(theme.palette.secondary.light, 0.75),
                        border: "1px solid rgba(31, 90, 44, 0.1)",
                        "& svg": {
                          fontSize: 25
                        }
                      })}
                    >
                      {getAchievementIcon(item)}
                    </Box>
                    {thaiYear && (
                      <Chip label={`พ.ศ. ${thaiYear}`} size="small" color="secondary" sx={{ fontWeight: 800 }} />
                    )}
                  </Stack>

                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <Chip
                      label={getAchievementCategory(item)}
                      size="small"
                      variant="outlined"
                      sx={{ alignSelf: "flex-start" }}
                    />
                    <Typography variant="h3" sx={{ fontSize: { xs: "1.05rem", md: "1.12rem" }, lineHeight: 1.28 }}>
                      {item.title}
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.65 }}>
                      {item.summary}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      {viewAllHref && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}>
          <Button href={normalizeSafeHref(viewAllHref)} endIcon={<ArrowForwardOutlinedIcon />}>
            {viewAllLabel}
          </Button>
        </Box>
      )}
    </Box>
  );
}
