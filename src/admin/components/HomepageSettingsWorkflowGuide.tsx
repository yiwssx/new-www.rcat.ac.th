import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const homepageSettingsSteps = [
  {
    title: "1. ตรวจข้อมูลหลัก",
    status: "Review",
    description: "ตรวจชื่อเว็บไซต์ ข้อมูลติดต่อ ลิงก์สำคัญ และข้อความหน้าแรกก่อนแก้ไข"
  },
  {
    title: "2. ปรับส่วนหน้าแรก",
    status: "Configure",
    description: "จัดการ hero, highlight, section และลิงก์ให้ตรงกับงานประชาสัมพันธ์ล่าสุด"
  },
  {
    title: "3. บันทึกและตรวจหน้าเว็บ",
    status: "Verify",
    description: "บันทึกค่าแล้วตรวจหน้าแรกจริง เพื่อยืนยันข้อความ รูปแบบ และลิงก์ปลายทาง"
  }
] as const;

export default function HomepageSettingsWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานตั้งค่าหน้าแรกแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เป็นเช็กลิสต์ก่อนแก้ค่าระบบและส่วนหน้าแรก เพื่อให้ข้อมูลสาธารณะถูกต้องก่อนเผยแพร่
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {homepageSettingsSteps.map((step) => (
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
