import { Box, Button, Container, Stack, Typography } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";

interface PublicErrorStateProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function PublicErrorState({ onRetry, isRetrying = false }: PublicErrorStateProps) {
  return (
    <Box
      role="alert"
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
        <Stack
          spacing={2.2}
          sx={{
            alignItems: "center",
            textAlign: "center"
          }}
        >
          <ReportProblemOutlinedIcon sx={{ fontSize: 58, color: "error.main" }} />
          <Stack spacing={0.8}>
            <Typography variant="h1" sx={{ fontSize: { xs: "1.8rem", sm: "2.3rem" } }}>
              ไม่สามารถโหลดข้อมูลได้
            </Typography>
            <Typography
              sx={{
                color: "text.secondary"
              }}
            >
              กรุณาลองใหม่อีกครั้ง หากยังไม่สำเร็จสามารถกลับหน้าแรกแล้วเลือกเมนูอื่นได้
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ width: { xs: "100%", sm: "auto" } }}>
            {onRetry && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshOutlinedIcon />}
                onClick={onRetry}
                disabled={isRetrying}
              >
                {isRetrying ? "กำลังลองใหม่" : "ลองอีกครั้ง"}
              </Button>
            )}
            <Button component="a" href="/" variant={onRetry ? "outlined" : "contained"} startIcon={<HomeOutlinedIcon />}>
              กลับหน้าแรก
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
