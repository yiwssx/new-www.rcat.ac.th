import Stack from "@mui/material/Stack";
import ContentHealthDashboard from "../components/ContentHealthDashboard";
import ContentLifecycleGovernancePanel from "../components/ContentLifecycleGovernancePanel";
import EditorialWorkflowPanel from "../components/EditorialWorkflowPanel";
import PreviewRevisionAutosaveWorkflowGuide from "../components/PreviewRevisionAutosaveWorkflowGuide";
import ContentPage from "./ContentPage";

export default function PreviewRevisionAutosaveWorkflowPage() {
  return (
    <Stack spacing={3}>
      <PreviewRevisionAutosaveWorkflowGuide />
      <EditorialWorkflowPanel />
      <ContentHealthDashboard />
      <ContentLifecycleGovernancePanel />
      <ContentPage />
    </Stack>
  );
}
