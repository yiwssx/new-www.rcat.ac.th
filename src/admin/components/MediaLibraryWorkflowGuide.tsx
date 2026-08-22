import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const mediaLibrarySteps = [
  {
    title: "1. อัปโหลดไฟล์",
    status: "Upload",
    description: "เลือกไฟล์ ตรวจขนาด และให้ระบบจัดประเภทให้อัตโนมัติ"
  },
  {
    title: "2. ตั้งชื่อให้ค้นเจอ",
    status: "Label",
    description: "ใช้ชื่อสื่อและผู้รับผิดชอบที่คนทำงานเข้าใจตรงกัน"
  },
  {
    title: "3. ใช้ซ้ำจาก Drive",
    status: "Reuse",
    description: "เปิดดูไฟล์ต้นทางและนำสื่อไปใช้กับข่าวหรือหน้าเว็บได้"
  }
] as const;

export default function MediaLibraryWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานคลังสื่อแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เป็นเช็กลิสต์ก่อนอัปโหลดและเลือกใช้สื่อ เพื่อให้ค้นหาและนำกลับมาใช้ซ้ำได้ง่าย
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {mediaLibrarySteps.map((step) => (
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
