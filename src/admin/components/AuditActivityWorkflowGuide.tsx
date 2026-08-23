import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const auditActivitySteps = [
  {
    title: "1. ตรวจเหตุการณ์",
    status: "Review",
    description: "ดูรายการสำคัญก่อนสรุปว่ามีความเสี่ยงหรือไม่"
  },
  {
    title: "2. ยืนยันผู้กระทำ",
    status: "Trace",
    description: "ตรวจเวลา ผู้ใช้งาน และหน้าที่เกี่ยวข้องให้ครบ"
  },
  {
    title: "3. บันทึกผลตรวจ",
    status: "Record",
    description: "เก็บหมายเหตุหรือหลักฐานก่อนดำเนินการต่อ"
  }
] as const;

export default function AuditActivityWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานตรวจสอบกิจกรรมระบบ</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เป็นเช็กลิสต์ก่อนตรวจ log สำรองข้อมูลและกิจกรรมที่เกี่ยวข้องกับระบบผู้ดูแล
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {auditActivitySteps.map((step) => (
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
