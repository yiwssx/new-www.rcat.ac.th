import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const mobileAdminSteps = [
  {
    title: "1. แตะได้ชัดเจน",
    status: "Touch",
    description: "ตรวจปุ่มหลัก เมนู และตัวกรองให้กดง่ายบนหน้าจอมือถือ"
  },
  {
    title: "2. นำทางไม่หลง",
    status: "Navigate",
    description: "ใช้เมนูด้านข้างและทางลัดแดชบอร์ดเพื่อเข้าหน้างานหลักได้เร็ว"
  },
  {
    title: "3. ตรวจผลก่อนออก",
    status: "Verify",
    description: "หลังบันทึกหรือเผยแพร่ ให้ตรวจสถานะและข้อความแจ้งผลก่อนเปลี่ยนหน้า"
  }
] as const;

export default function MobileAdminUsabilityGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานแอดมินบนมือถือ</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เป็นเช็กลิสต์เวลาทดสอบ CMS บนมือถือ โดยยึดการแตะ การนำทาง และการตรวจผลเป็นหลัก
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {mobileAdminSteps.map((step) => (
              <Box
                key={step.title}
                sx={{
                  flex: 1,
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.default"
                }}
              >
                <Stack spacing={0.75}>
                  <Chip
                    label={step.status}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ alignSelf: "start" }}
                  />
                  <Typography sx={{ fontWeight: 900 }}>{step.title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {step.description}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
