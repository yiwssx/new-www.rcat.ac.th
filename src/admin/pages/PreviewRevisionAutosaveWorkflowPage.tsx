import Stack from "@mui/material/Stack";
import ContentLifecycleGovernancePanel from "../components/ContentLifecycleGovernancePanel";
import PreviewRevisionAutosaveWorkflowGuide from "../components/PreviewRevisionAutosaveWorkflowGuide";
import ContentPage from "./ContentPage";

export default function PreviewRevisionAutosaveWorkflowPage() {
  return (
    <Stack spacing={3}>
      <PreviewRevisionAutosaveWorkflowGuide />
      <ContentLifecycleGovernancePanel />
      <ContentPage />
    </Stack>
  );
}
