import { Alert, Box, Stack } from "@mui/material";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";
import { getGoogleAppsScriptUrl } from "../../config/projectSettings";

export default function UsersPage() {
  const userManagementConfigured = Boolean(getGoogleAppsScriptUrl());

  return (
    <Box>
      <PageHeader title="ผู้ใช้" description="เพิ่ม แก้ไข ปิดใช้งาน และลบบัญชีผู้ใช้ระบบจัดการเว็บไซต์" />
      <Stack spacing={2.5}>
        {!userManagementConfigured && (
          <Alert severity="warning">
            Legacy user management: การจัดการผู้ใช้เดิมยังต้องใช้การเชื่อมต่อ Apps Script โดยตรง
            ส่วนการเข้าสู่ระบบผู้ดูแลใช้ admin proxy และข้อมูลโครงสร้างใช้ Cloudflare แล้ว
          </Alert>
        )}
        <UserManagementCard />
      </Stack>
    </Box>
  );
}
