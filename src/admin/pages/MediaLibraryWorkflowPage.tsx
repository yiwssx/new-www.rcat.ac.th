import Stack from "@mui/material/Stack";
import MediaLibraryWorkflowGuide from "../components/MediaLibraryWorkflowGuide";
import MediaUsageGovernancePanel from "../components/MediaUsageGovernancePanel";
import MediaPage from "./MediaPage";

export default function MediaLibraryWorkflowPage() {
  return (
    <Stack spacing={3}>
      <MediaLibraryWorkflowGuide />
      <MediaUsageGovernancePanel />
      <MediaPage />
    </Stack>
  );
}
