import { Box, Container, LinearProgress, Stack, Typography } from "@mui/material";
import { projectSettings } from "../../config/projectSettings";

export default function PublicLoadingState() {
  const logoPath = projectSettings.site.logoPath;

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        px: 2,
        py: 6
      }}
    >
      <Container maxWidth="sm">
        <Stack spacing={2.4} alignItems="center" textAlign="center">
          {logoPath && (
            <Box
              component="img"
              src={logoPath}
              alt={projectSettings.site.logoAlt || ""}
              sx={{
                width: { xs: 76, sm: 92 },
                height: { xs: 76, sm: 92 },
                objectFit: "contain"
              }}
            />
          )}
          <Stack spacing={0.8}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", sm: "2.3rem" } }}>
              กำลังโหลดข้อมูล
            </Typography>
            <Typography color="text.secondary">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลเว็บไซต์</Typography>
          </Stack>
          <LinearProgress
            aria-label="กำลังโหลดข้อมูล"
            sx={{
              width: "100%",
              maxWidth: 340,
              height: 8,
              borderRadius: 999
            }}
          />
        </Stack>
      </Container>
    </Box>
  );
}
