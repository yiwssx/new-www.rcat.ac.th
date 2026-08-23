import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

const menuManagementSteps = [
  {
    title: "1. วางโครงสร้าง",
    status: "Structure",
    description: "ตรวจเมนูหลัก เมนูย่อย และตำแหน่งก่อนเพิ่มรายการใหม่"
  },
  {
    title: "2. ตั้งชื่อและลิงก์",
    status: "Label / Link",
    description: "ใช้ชื่อที่ผู้ชมเข้าใจง่าย และตรวจลิงก์ให้เปิดได้ก่อนบันทึก"
  },
  {
    title: "3. เปิดใช้และจัดลำดับ",
    status: "Order",
    description: "เปิดหรือปิดการแสดงผล จัดลำดับ แล้วตรวจเมนูหน้าเว็บจริง"
  }
] as const;

export default function MenuManagementWorkflowGuide() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานจัดการเมนูแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เช็กลิสต์นี้ก่อนเพิ่ม แก้ หรือจัดลำดับเมนู เพื่อให้โครงสร้างหน้าเว็บชัดเจนและไม่ทำให้ผู้ชมหลงทาง
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {menuManagementSteps.map((step) => (
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
