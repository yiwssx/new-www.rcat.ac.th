import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const contentWorkflowSteps = [
  {
    title: "1. เขียนฉบับร่าง",
    status: "Draft",
    description: "เริ่มจากชื่อเรื่อง สรุป เนื้อหา รูปประกอบ หมวดหมู่ และแท็ก โดยยังไม่เผยแพร่ทันที"
  },
  {
    title: "2. ตรวจทานก่อนเผยแพร่",
    status: "Review",
    description: "ตรวจข้อความ ลิงก์ถาวร ผู้รับผิดชอบ วันที่เผยแพร่ และสื่อที่แนบให้ครบก่อนส่งขึ้นหน้าเว็บ"
  },
  {
    title: "3. เผยแพร่หรือกำหนดเวลา",
    status: "Publish / Schedule",
    description: "เลือกเผยแพร่ทันทีหรือกำหนดเวลา แล้วตรวจหน้าสาธารณะหลังบันทึกสำเร็จ"
  }
] as const;

export default function ContentWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานเขียนข่าวแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้ลำดับนี้เป็นเช็กลิสต์ก่อนเปิดตัวแก้ไข เพื่อให้การสร้างข่าวและประกาศไม่ข้ามขั้นตอนสำคัญ
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {contentWorkflowSteps.map((step) => (
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
                  <Chip label={step.status} size="small" color="primary" variant="outlined" sx={{ alignSelf: "start" }} />
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
