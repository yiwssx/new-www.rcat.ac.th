import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const documentWorkflowSteps = [
  {
    title: "1. เตรียมไฟล์",
    status: "Prepare",
    description: "ตั้งชื่อไฟล์ให้ชัด ตรวจเวอร์ชัน และเตรียมลิงก์เอกสารที่เปิดได้",
  },
  {
    title: "2. กรอกข้อมูล",
    status: "Describe",
    description: "ใส่ชื่อ หมวดหมู่ คำอธิบาย สถานะ และวันเผยแพร่ก่อนบันทึก",
  },
  {
    title: "3. เผยแพร่และจัดลำดับ",
    status: "Publish / Order",
    description: "เผยแพร่ ปักหมุด หรือจัดลำดับ แล้วตรวจหน้าเอกสารสาธารณะ",
  },
] as const;

export default function DocumentManagementWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานจัดการเอกสารแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เช็กลิสต์นี้ก่อนเพิ่มหรือแก้เอกสาร เพื่อให้ไฟล์พร้อมเผยแพร่และค้นหาได้ง่าย
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {documentWorkflowSteps.map((step) => (
              <Box
                key={step.title}
                sx={{
                  flex: 1,
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.default",
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
