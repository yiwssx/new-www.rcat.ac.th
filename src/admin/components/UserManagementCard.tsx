import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { useAuth } from "../../context/authSessionContext";
import { ADMIN_READ_ONLY_NOTICE, canManageAdminData, isReadOnlyAdminUser } from "../utils/rbac";
import { userRoleLabels } from "../../utils/thaiLabels";
import type { User } from "../../types";

const roleRows: Array<{ role: User["role"]; description: string }> = [
  {
    role: "admin",
    description: "จัดการได้ทุกอย่าง รวมถึงสร้าง แก้ไข ลบ เผยแพร่ อัปโหลด และบันทึกการตั้งค่า"
  },
  {
    role: "editor",
    description: "อ่านข้อมูลได้เท่านั้น ไม่สามารถแก้ไข เผยแพร่ อัปโหลด หรือลบข้อมูล"
  },
  {
    role: "viewer",
    description: "อ่านข้อมูลได้เท่านั้น ไม่สามารถแก้ไข เผยแพร่ อัปโหลด หรือลบข้อมูล"
  }
];

const rbacEnvRows = [
  { key: "ADMIN_RBAC_ADMINS", value: "admin@example.invalid" },
  { key: "ADMIN_RBAC_EDITORS", value: "" },
  { key: "ADMIN_RBAC_VIEWERS", value: "" }
];

export default function UserManagementCard() {
  const { session } = useAuth();
  const role = session?.user.role;
  const canManage = canManageAdminData(session?.user);
  const readOnly = isReadOnlyAdminUser(session?.user);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ManageAccountsOutlinedIcon color="primary" />
              <Box>
                <Typography variant="h3">ผู้ใช้และสิทธิ์การเข้าถึง</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                  จัดการผู้ใช้ผ่าน Cloudflare Access และกำหนดสิทธิ์ด้วยค่าแวดล้อมของ Cloudflare
                </Typography>
              </Box>
            </Stack>
            <Chip
              color={canManage ? "success" : "default"}
              label={role ? `บทบาทปัจจุบัน: ${userRoleLabels[role]}` : "ยังไม่มีเซสชันผู้ใช้"}
              sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
            />
          </Stack>

          <Alert severity="info" icon={<SecurityOutlinedIcon />}>
            ระบบนี้ย้ายการจัดการผู้ใช้ออกจาก Apps Script แล้ว ผู้ดูแลระบบต้องสร้างบัญชีและกำหนดกลุ่มผู้ใช้ผ่าน
            Cloudflare Access หรือค่าแวดล้อมที่กำหนดใน Cloudflare โดยไม่บันทึกอีเมลจริงหรือข้อมูลลับลงใน Git
          </Alert>

          {readOnly && <Alert severity="warning">{ADMIN_READ_ONLY_NOTICE}</Alert>}

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: "100%",
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  bgcolor: "background.default"
                }}
              >
                <Typography fontWeight={900}>ผู้ใช้ปัจจุบัน</Typography>
                <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                  <Typography variant="body2">
                    อีเมล: <strong>{session?.user.email ?? "ไม่พบข้อมูลเซสชัน"}</strong>
                  </Typography>
                  <Typography variant="body2">
                    สิทธิ์: <strong>{role ? userRoleLabels[role] : "ไม่ทราบ"}</strong>
                  </Typography>
                  <Typography variant="body2">
                    โหมดการยืนยันตัวตน: <strong>Cloudflare Access / Admin Proxy</strong>
                  </Typography>
                </Stack>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: "100%",
                  p: 2,
                  borderRadius: 2,
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  bgcolor: "background.default"
                }}
              >
                <Typography fontWeight={900}>ค่าแวดล้อม Cloudflare RBAC</Typography>
                <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                  {rbacEnvRows.map((row) => (
                    <Typography key={row.key} variant="body2" sx={{ fontFamily: "monospace" }}>
                      {row.key}
                      {row.value ? ` = "${row.value}"` : ' = ""'}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          <Box
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(31, 90, 44, 0.12)",
              overflow: "hidden"
            }}
          >
            {roleRows.map((row, index) => (
              <Stack
                key={row.role}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  p: 1.5,
                  borderTop: index === 0 ? 0 : "1px solid rgba(31, 90, 44, 0.12)",
                  bgcolor: row.role === role ? "primary.light" : "background.paper"
                }}
              >
                <Typography sx={{ minWidth: 120, fontWeight: 900 }}>{userRoleLabels[row.role]}</Typography>
                <Typography color="text.secondary">{row.description}</Typography>
              </Stack>
            ))}
          </Box>

          <Alert severity={canManage ? "success" : "warning"}>
            {canManage
              ? "บัญชี admin สามารถจัดการข้อมูลและการตั้งค่าทั้งหมดได้"
              : "บัญชี editor และ viewer เป็นสิทธิ์อ่านอย่างเดียว ปุ่มเพิ่ม แก้ไข ลบ เผยแพร่ อัปโหลด และบันทึกการตั้งค่าต้องไม่สามารถใช้งานได้"}
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
}
