import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

interface MockVisitorStat {
  label: string;
  value: string;
  helper?: string;
}

const mockVisitorStats: MockVisitorStat[] = [
  { label: "วันนี้", value: "128", helper: "ผู้เข้าชม" },
  { label: "เมื่อวาน", value: "342", helper: "ผู้เข้าชม" },
  { label: "เดือนนี้", value: "8,764", helper: "ผู้เข้าชม" },
  { label: "ทั้งหมด", value: "156,892", helper: "ครั้ง" }
];

export function VisitorStatsCard() {
  return (
    <Card
      component="section"
      aria-label="จำนวนผู้เข้าชมเว็บไซต์"
      sx={{
        borderTop: "5px solid",
        borderColor: "secondary.main",
        bgcolor: "background.paper"
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.2} alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={(theme) => ({
                width: 42,
                height: 42,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                color: "primary.dark",
                bgcolor: alpha(theme.palette.secondary.light, 0.7),
                flexShrink: 0
              })}
            >
              <VisibilityOutlinedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={900} sx={{ color: "primary.dark", lineHeight: 1.25 }}>
                จำนวนผู้เข้าชมเว็บไซต์
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.45 }}>
                ข้อมูลตัวอย่างสำหรับแสดงผลสถิติการเข้าชม
              </Typography>
            </Box>
          </Stack>
          <Chip
            icon={<PeopleAltOutlinedIcon />}
            label="Mock"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ flexShrink: 0, fontWeight: 800 }}
          />
        </Stack>

        <Grid container spacing={1.2}>
          {mockVisitorStats.map((stat) => (
            <Grid size={{ xs: 6 }} key={stat.label}>
              <Box
                sx={(theme) => ({
                  height: "100%",
                  borderRadius: 1.5,
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  bgcolor: alpha(theme.palette.primary.light, 0.42),
                  p: 1.35
                })}
              >
                <Typography variant="body2" color="text.secondary" fontWeight={800}>
                  {stat.label}
                </Typography>
                <Typography sx={{ color: "primary.dark", fontSize: { xs: "1.35rem", md: "1.5rem" }, fontWeight: 900 }}>
                  {stat.value}
                </Typography>
                {stat.helper && (
                  <Typography variant="caption" color="text.secondary">
                    {stat.helper}
                  </Typography>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
