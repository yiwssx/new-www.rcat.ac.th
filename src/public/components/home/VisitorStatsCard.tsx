import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { normalizeVisitorStats } from "../../../services/visitorStats";
import { VisitorStatsSettings } from "../../../types";
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
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.2} alignItems="flex-start" justifyContent="space-between">
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={(theme) => ({
                  width: 44,
                  height: 44,
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
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={900} sx={{ color: "primary.dark", lineHeight: 1.2 }}>
                  Website Visitors
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.45 }}>
                  สถิติผู้เข้าชมเว็บไซต์
                </Typography>
              </Box>
            </Stack>
            <Chip label={getUpdatedLabel(normalizedStats.updatedAt)} size="small" variant="outlined" />
          </Stack>

          <Box
            sx={(theme) => ({
              borderRadius: 2,
              p: 1.7,
              bgcolor: alpha(theme.palette.primary.light, 0.45),
              border: "1px solid rgba(31, 90, 44, 0.12)"
            })}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
              <Box>
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

          <Grid container spacing={1.1}>
            {secondaryStats.map((stat) => (
              <Grid size={{ xs: 6 }} key={stat.label}>
                <Box
                  sx={{
                    height: "100%",
                    borderRadius: 1.5,
                    border: "1px solid rgba(31, 90, 44, 0.1)",
                    p: 1.25,
                    bgcolor: "rgba(255, 255, 255, 0.75)"
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>
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
              <Stack direction="row" spacing={0.8} alignItems="center">
                <FiberManualRecordIcon sx={{ color: "#16a34a", fontSize: 13 }} />
                <Box>
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
