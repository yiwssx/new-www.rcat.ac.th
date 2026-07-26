import { Box, Stack } from "@mui/material";
import PageHeader from "../components/PageHeader";
import UserManagementCard from "../components/UserManagementCard";

export default function UsersPage() {
  return (
    <Box>
      <PageHeader
        title="ผู้ใช้และสิทธิ์การเข้าถึง"
        description="ค้นหาและจัดการผู้ใช้แบบแบ่งหน้าผ่าน CMS Session, RBAC และ D1"
      />
      <Stack spacing={2.5}>
        <UserManagementCard />
      </Stack>
    </Box>
  );
}
