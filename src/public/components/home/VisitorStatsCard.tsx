import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { VisitorStatsSettings } from "../../../features/visitor-stats";
import { normalizeVisitorStats } from "../../../services/visitorStats";
import { formatDisplayDateTime } from "../../../utils/dateDisplay";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatStatValue(value: number) {
  return numberFormatter.format(value);
}

function getUpdatedLabel(updatedAt: string) {
  return updatedAt ? `Updated ${formatDisplayDateTime(updatedAt)}` : "Updated";
}

export function VisitorStatsCard({ stats }: { stats?: VisitorStatsSettings }) {
  const normalizedStats = normalizeVisitorStats(stats);

  if (!stats || !normalizedStats.enabled) {
    return null;
  }

  const secondaryStats = [
    { label: "Users Today", value: normalizedStats.usersToday },
    { label: "Users Yesterday", value: normalizedStats.usersYesterday },
    { label: "Users This Month", value: normalizedStats.usersThisMonth },
    { label: "Users This Year", value: normalizedStats.usersThisYear },
    { label: "Total Users", value: normalizedStats.totalUsers }
  ];

  return (
    <Card
      component="section"
      aria-label="Website Visitors"
      sx={{
        borderTop: "5px solid",
        borderColor: "secondary.main",
        bgcolor: "background.paper",
        overflow: "hidden"
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={{ xs: 1.75, sm: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row", lg: "column", xl: "row" }}
            spacing={{ xs: 1.15, sm: 1.2 }}
            alignItems={{ xs: "stretch", sm: "flex-start", lg: "stretch", xl: "flex-start" }}
            justifyContent="space-between"
            useFlexGap
            sx={{ minWidth: 0 }}
          >
            <Stack
              direction="row"
              spacing={1.1}
              alignItems="center"
              sx={{
                minWidth: 0,
                width: { xs: "100%", sm: "auto", lg: "100%", xl: "auto" },
                flex: "1 1 auto"
              }}
            >
              <Box
                sx={(theme) => ({
                  width: { xs: 40, sm: 44 },
                  height: { xs: 40, sm: 44 },
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  color: "primary.dark",
                  bgcolor: alpha(theme.palette.secondary.light, 0.72),
                  flexShrink: 0
                })}
              >
                <VisibilityOutlinedIcon />
              </Box>
              <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
                <Typography
                  component="h2"
                  fontWeight={900}
                  sx={{ color: "primary.dark", fontSize: { xs: "1rem", sm: "1.05rem" }, lineHeight: 1.2 }}
                >
                  Website Visitors
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.35, lineHeight: 1.45, whiteSpace: "normal", wordBreak: "normal" }}
                >
                  สถิติผู้เข้าชมเว็บไซต์
                </Typography>
              </Box>
            </Stack>
            <Chip
              label={getUpdatedLabel(normalizedStats.updatedAt)}
              size="small"
              variant="outlined"
              sx={{
                alignSelf: { xs: "flex-start", sm: "flex-start" },
                maxWidth: { xs: "100%", sm: 240 },
                "& .MuiChip-label": {
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }
              }}
            />
          </Stack>

          <Box
            sx={(theme) => ({
              borderRadius: 2,
              p: { xs: 1.45, sm: 1.7 },
              bgcolor: alpha(theme.palette.primary.light, 0.45),
              border: "1px solid rgba(31, 90, 44, 0.12)"
            })}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={800}>
                  Total views
                </Typography>
                <Typography sx={{ color: "primary.dark", fontSize: { xs: "1.75rem", md: "2rem" }, fontWeight: 900 }}>
                  {formatStatValue(normalizedStats.totalViews)}
                </Typography>
              </Box>
              <VisibilityOutlinedIcon sx={{ color: "primary.main", fontSize: 34 }} />
            </Stack>
          </Box>

          <Grid container spacing={{ xs: 1, sm: 1.1 }}>
            {secondaryStats.map((stat) => (
              <Grid size={{ xs: 12, sm: 6 }} key={stat.label}>
                <Box
                  sx={{
                    height: "100%",
                    minHeight: { xs: 68, sm: 74 },
                    borderRadius: 1.5,
                    border: "1px solid rgba(31, 90, 44, 0.1)",
                    p: { xs: 1.15, sm: 1.25 },
                    bgcolor: "rgba(255, 255, 255, 0.75)"
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={800}
                    sx={{ display: "block", lineHeight: 1.35, whiteSpace: "normal", wordBreak: "normal" }}
                  >
                    {stat.label}
                  </Typography>
                  <Typography sx={{ color: "primary.dark", fontSize: "1.2rem", fontWeight: 900 }}>
                    {formatStatValue(stat.value)}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box
            sx={{
              borderRadius: 2,
              p: 1.4,
              border: "1px solid rgba(31, 90, 44, 0.12)",
              bgcolor: "rgba(236, 253, 245, 0.86)"
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
                <FiberManualRecordIcon sx={{ color: "#16a34a", fontSize: 13 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={800}>
                    Who&apos;s Online
                  </Typography>
                  <Typography sx={{ color: "primary.dark", fontWeight: 900 }}>
                    {formatStatValue(normalizedStats.onlineUsers)}
                  </Typography>
                </Box>
              </Stack>
              <PeopleAltOutlinedIcon sx={{ color: "primary.main", fontSize: 28 }} />
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
