import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const previewRevisionSteps = [
  {
    title: "1. ตรวจตัวอย่าง",
    status: "Preview",
    description: "เปิดดูหน้าสาธารณะหรือสถานะเนื้อหาก่อนเผยแพร่จริง"
  },
  {
    title: "2. ทบทวนการแก้ไข",
    status: "Revision",
    description: "ตรวจชื่อเรื่อง slug หมวดหมู่ และสื่อประกอบก่อนบันทึก"
  },
  {
    title: "3. กู้คืนฉบับร่าง",
    status: "Autosave",
    description: "ใช้ข้อความกู้คืนเมื่อพบฉบับร่างจากการโหลดหน้าใหม่"
  }
] as const;

export default function PreviewRevisionAutosaveWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานตรวจตัวอย่างและฉบับร่าง</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เป็นเช็กลิสต์ก่อนบันทึก เผยแพร่ หรือกู้คืนเนื้อหาที่แก้ไขค้างไว้
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {previewRevisionSteps.map((step) => (
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
