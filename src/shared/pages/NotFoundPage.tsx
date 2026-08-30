import { Box, Button, Container, Stack, Typography } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";

export default function NotFoundPage() {
  return (
    <Box
      component="main"
      aria-labelledby="not-found-title"
      sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2 }}
      className="min-h-screen grid place-items-center bg-[linear-gradient(135deg,_rgba(248,251,242,1)_0%,_rgba(232,245,233,1)_45%,_rgba(255,244,194,0.5)_100%)]"
    >
      <Container maxWidth="sm">
        <Stack
          spacing={2}
          sx={{
            alignItems: "flex-start"
          }}
        >
          <Typography id="not-found-title" variant="h1">
            ไม่พบหน้าที่ต้องการ
          </Typography>
          <Typography
            sx={{
              color: "text.secondary"
            }}
          >
            หน้าที่คุณกำลังเปิดอาจถูกย้าย เปลี่ยนชื่อ หรือไม่มีอยู่แล้ว
            คุณสามารถกลับหน้าแรกหรือค้นหาเนื้อหาในเว็บไซต์ได้
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <Button component="a" href="/" variant="contained" startIcon={<HomeOutlinedIcon />}>
              กลับหน้าแรก
            </Button>
            <Button component="a" href="/search" variant="outlined" startIcon={<SearchOutlinedIcon />}>
              ค้นหาในเว็บไซต์
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
