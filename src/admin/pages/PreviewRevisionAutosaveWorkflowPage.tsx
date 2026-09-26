import Stack from "@mui/material/Stack";
import ContentHealthDashboard from "../components/ContentHealthDashboard";
import ContentLifecycleGovernancePanel from "../components/ContentLifecycleGovernancePanel";
import ContentRedirectManagerPanel from "../components/ContentRedirectManagerPanel";
import EditorialWorkflowPanel from "../components/EditorialWorkflowPanel";
import PreviewRevisionAutosaveWorkflowGuide from "../components/PreviewRevisionAutosaveWorkflowGuide";
import RevisionComparePanel from "../components/RevisionComparePanel";
import TaxonomyManagerPanel from "../components/TaxonomyManagerPanel";
import ContentPage from "./ContentPage";

export default function PreviewRevisionAutosaveWorkflowPage() {
  return (
    <Stack spacing={3}>
      <PreviewRevisionAutosaveWorkflowGuide />
      <EditorialWorkflowPanel />
      <ContentHealthDashboard />
      <ContentLifecycleGovernancePanel />
      <RevisionComparePanel />
      <TaxonomyManagerPanel />
      <ContentRedirectManagerPanel />
      <ContentPage />
    </Stack>
  );
}
