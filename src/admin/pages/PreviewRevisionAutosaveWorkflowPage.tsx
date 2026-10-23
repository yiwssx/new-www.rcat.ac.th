import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ContentWorkflowGuide from "../components/PreviewRevisionAutosaveWorkflowGuide";
import EditorialWorkflowPanel from "../components/EditorialWorkflowPanel";
import ContentHealthDashboard from "../components/ContentHealthDashboard";
import RevisionHistoryViewer from "../components/RevisionHistoryViewer";
import ContentLifecycleGovernancePanel from "../components/ContentLifecycleGovernancePanel";
import RevisionComparePanel from "../components/RevisionComparePanel";
import TaxonomyManagerPanel from "../components/TaxonomyManagerPanel";
import ContentRedirectManagerPanel from "../components/ContentRedirectManagerPanel";
import ContentPage from "./ContentPage";

// Only mount the selected workspace. The previous screen mounted all eight
// operational panels before the content list and triggered unrelated queries.
// Static imports preserve the existing editor-bundle governance baseline;
// further code splitting needs its own measured performance change.
type WorkspaceSection = "list" | "editorial" | "revisions" | "taxonomy" | "governance";

const sections: { value: WorkspaceSection; label: string }[] = [
  { value: "list", label: "รายการเนื้อหา" },
  { value: "editorial", label: "การตรวจทาน" },
  { value: "revisions", label: "ประวัติและเวอร์ชัน" },
  { value: "taxonomy", label: "หมวดหมู่และลิงก์" },
  { value: "governance", label: "คุณภาพและกำหนดเวลา" }
];

export default function PreviewRevisionAutosaveWorkflowPage() {
  const [section, setSection] = useState<WorkspaceSection>("list");

  return (
    <Stack spacing={2}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", minWidth: 0 }}>
        <Tabs
          value={section}
          onChange={(_, nextSection: WorkspaceSection) => setSection(nextSection)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="หมวดเครื่องมือจัดการเนื้อหา"
        >
          {sections.map((entry) => (
            <Tab
              key={entry.value}
              value={entry.value}
              label={entry.label}
              id={`admin-content-tab-${entry.value}`}
              aria-controls={`admin-content-panel-${entry.value}`}
            />
          ))}
        </Tabs>
      </Box>
      <Box
        role="tabpanel"
        id={`admin-content-panel-${section}`}
        aria-labelledby={`admin-content-tab-${section}`}
        sx={{ minWidth: 0 }}
      >

        {section === "list" && <ContentPage />}
        {section === "editorial" && (
            <Stack spacing={2}>
              <ContentWorkflowGuide />
              <EditorialWorkflowPanel />
            </Stack>
        )}
        {section === "revisions" && (
            <Stack spacing={2}>
              <RevisionHistoryViewer />
              <RevisionComparePanel />
            </Stack>
        )}
        {section === "taxonomy" && (
            <Stack spacing={2}>
              <TaxonomyManagerPanel />
              <ContentRedirectManagerPanel />
            </Stack>
        )}
        {section === "governance" && (
            <Stack spacing={2}>
              <ContentHealthDashboard />
              <ContentLifecycleGovernancePanel />
            </Stack>
        )}

      </Box>
    </Stack>
  );
}
