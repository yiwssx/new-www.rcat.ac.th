import Stack from "@mui/material/Stack";
import ContentScopeManagementPanel from "../components/ContentScopeManagementPanel";
import UserRoleCapabilityWorkflowGuide from "../components/UserRoleCapabilityWorkflowGuide";
import UsersPage from "./UsersPage";

export default function UserRoleCapabilityWorkflowPage() {
  return (
    <Stack spacing={3}>
      <UserRoleCapabilityWorkflowGuide />
      <ContentScopeManagementPanel />
      <UsersPage />
    </Stack>
  );
}
