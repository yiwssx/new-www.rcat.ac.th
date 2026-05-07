import { Box, Container, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { projectSettings } from "../../config/projectSettings";

export default function PublicLoadingState() {
  const logoPath = projectSettings.site.logoPath;
  const siteName = projectSettings.site.name;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={(theme) => ({
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        background: `radial-gradient(circle at top, ${alpha(theme.palette.primary.light, 0.42)} 0%, ${theme.palette.background.default} 48%, ${alpha(theme.palette.secondary.light, 0.38)} 100%)`,
        px: 2,
        py: 6
      })}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            maxWidth: 460,
            mx: "auto",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            bgcolor: "rgba(255, 255, 255, 0.82)",
            border: "1px solid rgba(31, 90, 44, 0.12)",
            boxShadow: "0 18px 42px rgba(31, 90, 44, 0.14)",
            backdropFilter: "blur(8px)"
          }}
        >
          <Stack spacing={2.4} alignItems="center" textAlign="center">
            {logoPath && (
              <Box
                sx={(theme) => ({
                  width: { xs: 96, sm: 112 },
                  height: { xs: 96, sm: 112 },
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.primary.light, 0.26),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`
                })}
              >
                <Box
                  component="img"
                  src={logoPath}
                  alt={projectSettings.site.logoAlt || ""}
                  sx={{
                    width: { xs: 72, sm: 84 },
                    height: { xs: 72, sm: 84 },
                    objectFit: "contain"
                  }}
                />
              </Box>
            )}
            <Stack spacing={0.8}>
              <Typography color="primary.dark" fontWeight={900} sx={{ fontSize: { xs: "0.95rem", sm: "1.05rem" } }}>
                {siteName}
              </Typography>
              <Typography
                variant="h1"
                sx={{ fontSize: { xs: "1.55rem", sm: "1.9rem" }, fontWeight: 900, lineHeight: 1.25 }}
              >
                กำลังโหลดข้อมูล
              </Typography>
              <Typography color="text.secondary">กรุณารอสักครู่ ระบบกำลังเตรียมข้อมูลเว็บไซต์สำหรับคุณ</Typography>
              <Box component="span" aria-hidden="true" sx={{ display: "none" }}>
                กรุณารอสักครู่ ระบบกำลังดึงข้อมูลเว็บไซต์
              </Box>
            </Stack>
            <Stack spacing={1.2} alignItems="center" sx={{ width: "100%" }}>
              <LinearProgress
                aria-label="กำลังโหลดข้อมูล"
                sx={(theme) => ({
                  width: "100%",
                  maxWidth: 320,
                  height: 7,
                  borderRadius: 999,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999
                  }
                })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
                กำลังเชื่อมต่อระบบข้อมูลสาธารณะ...
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
