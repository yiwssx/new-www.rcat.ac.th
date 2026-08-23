import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const userRoleCapabilitySteps = [
  {
    title: "1. ตรวจบทบาท",
    status: "Review role",
    description: "ตรวจระดับสิทธิ์และหน้าที่ของผู้ใช้ก่อนแก้ไขหรือเชิญใช้งาน"
  },
  {
    title: "2. กำหนดขอบเขต",
    status: "Assign scope",
    description: "เลือกบทบาทตามงานจริง ไม่เปิดสิทธิ์เกินจำเป็นสำหรับการดูแลเว็บ"
  },
  {
    title: "3. ทวนการเข้าถึง",
    status: "Verify access",
    description: "ตรวจว่าผู้ใช้เข้าเมนูที่ต้องใช้ได้ โดยไม่กระทบสิทธิ์ของผู้อื่น"
  }
] as const;

export default function UserRoleCapabilityWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานบทบาทและสิทธิ์ผู้ใช้แบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เช็กลิสต์นี้ก่อนเพิ่มหรือแก้ผู้ใช้ เพื่อให้สิทธิ์ตรงกับหน้าที่และลดความเสี่ยงจากสิทธิ์เกินจำเป็น
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {userRoleCapabilitySteps.map((step) => (
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
