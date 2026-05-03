import { Box, Button, Container, Stack, Typography } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { useNavigate } from "@tanstack/react-router";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2 }}
      className="min-h-screen grid place-items-center bg-[linear-gradient(135deg,_rgba(248,251,242,1)_0%,_rgba(232,245,233,1)_45%,_rgba(255,244,194,0.5)_100%)]"
    >
      <Container maxWidth="sm">
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h1">ไม่พบหน้า</Typography>
          <Typography color="text.secondary">เส้นทาง CMS ที่ร้องขอไม่มีอยู่ในระบบนี้</Typography>
          <Button variant="contained" startIcon={<HomeOutlinedIcon />} onClick={() => void navigate({ to: "/" })}>
            หน้าแรก
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
