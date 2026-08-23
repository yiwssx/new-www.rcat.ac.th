import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const dashboardWorkflowSteps = [
  {
    title: "1. ตรวจภาพรวม",
    status: "Overview",
    description: "ดูตัวเลขสำคัญและสถานะล่าสุดก่อนเริ่มงานดูแลเว็บ"
  },
  {
    title: "2. เลือกงานถัดไป",
    status: "Shortcut",
    description: "ใช้ปุ่มลัดไปยังข่าว สื่อ เอกสาร เมนู หรือการตั้งค่าที่ต้องทำ"
  },
  {
    title: "3. ตรวจงานหลังแก้",
    status: "Verify",
    description: "กลับมาตรวจผลรวมและไปดูหน้าสาธารณะหลังบันทึกงานสำคัญ"
  }
] as const;

export default function AdminDashboardWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานหน้าแดชบอร์ดแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้หน้าแดชบอร์ดเป็นจุดเริ่มงานประจำวันและเป็นทางลัดไปยังงานดูแลเว็บหลัก
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {dashboardWorkflowSteps.map((step) => (
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
