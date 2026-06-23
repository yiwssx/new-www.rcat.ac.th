import { Box, Stack } from "@mui/material";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";

export default function UsersPage() {
  return (
    <Box>
      <PageHeader
        title="ผู้ใช้และสิทธิ์การเข้าถึง"
        description="จัดการผู้ใช้ผ่าน Cloudflare Access และกำหนดสิทธิ์ด้วยค่าแวดล้อมของ Cloudflare"
      />
      <Stack spacing={2.5}>
        <UserManagementCard />
      </Stack>
    </Box>
  );
}
