import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import { PublicContentCardItem } from "../../../types";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { interactiveSurfaceSx } from "../../../design-system/componentStyles";
import { designTokens } from "../../../design-system/tokens";
import { formatDisplayYear } from "../../../utils/dateDisplay";

function getAchievementHaystack(item: PublicContentCardItem) {
  return [item.title, item.summary, item.category, ...(item.tags ?? [])].join(" ").toLowerCase();
}

function getAchievementIcon(item: PublicContentCardItem) {
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

function getAchievementCategory(item: PublicContentCardItem) {
  return item.category || item.tags?.[0] || "ผลงาน";
}

function compareContentPublishAtDesc(left: PublicContentCardItem, right: PublicContentCardItem) {
  const leftTime = Date.parse(left.publishAt);
  const rightTime = Date.parse(right.publishAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(right.publishAt || "").localeCompare(String(left.publishAt || "")) || right.id.localeCompare(left.id);
}

function getVisibleItems(items: PublicContentCardItem[], limit: number | undefined) {
  const sortedItems = [...items].sort(compareContentPublishAtDesc);

  if (limit === undefined) {
    return sortedItems;
  }

  return sortedItems.slice(0, Math.max(0, Math.floor(limit)));
}

interface AchievementHighlightsSectionProps {
  items: PublicContentCardItem[];
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
  const featuredItem = visibleItems[0];
  const supportingItems = visibleItems.slice(1);

  if (!featuredItem) {
    return null;
  }

  const featuredYear = formatDisplayYear(featuredItem.publishAt);
  const featuredHref = normalizeSafeHref(`/content/${featuredItem.slug}`);

  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <Box
        sx={(theme) => ({
          p: { xs: 2, md: 2.75 },
          borderRadius: `${designTokens.radius.large}px`,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, 0.035),
          boxShadow: designTokens.elevation.low
        })}
      >
        <HomeSectionHeading
          label="ความสำเร็จ"
          title="ผลงานและความภาคภูมิใจ"
          description="รวมผลงานเด่น รางวัล และความภาคภูมิใจของนักเรียนนักศึกษา ครู บุคลากร และสถานศึกษา"
          action={
            viewAllHref ? (
              <Button
                href={normalizeSafeHref(viewAllHref)}
                variant="outlined"
                size="small"
                endIcon={<ArrowForwardOutlinedIcon />}
              >
                {viewAllLabel}
              </Button>
            ) : undefined
          }
        />

        <Card
          component="a"
          href={featuredHref}
          aria-label={`อ่านผลงาน ${featuredItem.title}`}
          sx={(theme) => ({
            ...interactiveSurfaceSx,
            display: "block",
            position: "relative",
            overflow: "hidden",
            mb: 2,
            color: "inherit",
            textDecoration: "none",
            borderColor: alpha(theme.palette.primary.main, 0.3),
            bgcolor: "background.paper",
            boxShadow: designTokens.elevation.medium,
            "&:hover": {
              borderColor: "primary.main",
              transform: "translateY(-2px)",
              ...interactiveSurfaceSx["&:hover"]
            }
          })}
        >
          <CardContent
            sx={{
              p: { xs: 2.25, md: 3 },
              display: "flex",
              alignItems: { xs: "flex-start", md: "center" },
              gap: { xs: 2, md: 3 }
            }}
          >
            <Box
              sx={(theme) => ({
                width: { xs: 52, md: 66 },
                height: { xs: 52, md: 66 },
                flex: "0 0 auto",
                borderRadius: `${designTokens.radius.large}px`,
                display: "grid",
                placeItems: "center",
                color: "primary.dark",
                bgcolor: alpha(theme.palette.secondary.light, 0.78),
                border: "1px solid",
                borderColor: alpha(theme.palette.secondary.dark, 0.2),
                "& svg": {
                  fontSize: { xs: 30, md: 38 }
                }
              })}
            >
              {getAchievementIcon(featuredItem)}
            </Box>

            <Stack spacing={1.15} sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Chip label="ผลงานล่าสุด" size="small" color="primary" sx={{ fontWeight: 800 }} />
                <Chip label={getAchievementCategory(featuredItem)} size="small" variant="outlined" />
                {featuredYear && (
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                    พ.ศ. {featuredYear}
                  </Typography>
                )}
              </Stack>

              <Typography
                variant="h3"
                sx={{
                  fontSize: { xs: "1.18rem", md: "1.34rem" },
                  lineHeight: 1.35,
                  pr: { md: 4 }
                }}
              >
                {featuredItem.title}
              </Typography>

              {featuredItem.summary && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    lineHeight: 1.65,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}
                >
                  {featuredItem.summary}
                </Typography>
              )}

              <Stack direction="row" spacing={0.7} sx={{ alignItems: "center", color: "primary.main" }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  อ่านรายละเอียดผลงาน
                </Typography>
                <ArrowForwardOutlinedIcon sx={{ fontSize: 18 }} />
              </Stack>
            </Stack>

            <WorkspacePremiumOutlinedIcon
              aria-hidden="true"
              sx={(theme) => ({
                display: { xs: "none", md: "block" },
                position: "absolute",
                right: 20,
                bottom: -24,
                fontSize: 142,
                color: alpha(theme.palette.primary.main, 0.055),
                pointerEvents: "none"
              })}
            />
          </CardContent>
        </Card>

        {supportingItems.length > 0 && (
          <Grid container spacing={1.5}>
            {supportingItems.map((item, index) => {
              const thaiYear = formatDisplayYear(item.publishAt);
              const href = normalizeSafeHref(`/content/${item.slug}`);
              const spansFullRow = supportingItems.length % 2 === 1 && index === supportingItems.length - 1;

              return (
                <Grid size={{ xs: 12, sm: spansFullRow ? 12 : 6 }} key={item.id}>
                  <Card
                    component="a"
                    href={href}
                    aria-label={`อ่านผลงาน ${item.title}`}
                    sx={{
                      ...interactiveSurfaceSx,
                      display: "block",
                      height: "100%",
                      color: "inherit",
                      textDecoration: "none",
                      bgcolor: "background.paper",
                      "&:hover": {
                        borderColor: "primary.main",
                        transform: "translateY(-2px)",
                        ...interactiveSurfaceSx["&:hover"]
                      }
                    }}
                  >
                    <CardContent
                      sx={{
                        height: "100%",
                        p: 1.75,
                        display: "flex",
                        gap: 1.4,
                        alignItems: "flex-start"
                      }}
                    >
                      <Box
                        sx={(theme) => ({
                          width: 40,
                          height: 40,
                          flex: "0 0 auto",
                          borderRadius: `${designTokens.radius.medium}px`,
                          display: "grid",
                          placeItems: "center",
                          color: "primary.dark",
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          "& svg": {
                            fontSize: 23
                          }
                        })}
                      >
                        {getAchievementIcon(item)}
                      </Box>

                      <Stack spacing={0.65} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.8} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                          <Typography variant="caption" sx={{ color: "primary.dark", fontWeight: 800 }}>
                            {getAchievementCategory(item)}
                          </Typography>
                          {thaiYear && (
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              พ.ศ. {thaiYear}
                            </Typography>
                          )}
                        </Stack>

                        <Typography
                          variant="h3"
                          sx={{
                            fontSize: { xs: "1rem", md: "1.05rem" },
                            lineHeight: 1.38,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                          }}
                        >
                          {item.title}
                        </Typography>

                        {item.summary && (
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.84rem",
                              lineHeight: 1.55,
                              display: "-webkit-box",
                              WebkitLineClamp: spansFullRow ? 1 : 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden"
                            }}
                          >
                            {item.summary}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
