import { lazy, Suspense, useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

// Only mount the selected workspace. The former page mounted every operational
// dashboard above the content list, producing a very long admin page and
// triggering unrelated queries on every visit.
const ContentPage = lazy(() => import("./ContentPage"));
const PreviewRevisionAutosaveWorkflowGuide = lazy(() => import("../components/PreviewRevisionAutosaveWorkflowGuide"));
const EditorialWorkflowPanel = lazy(() => import("../components/EditorialWorkflowPanel"));
const ContentHealthDashboard = lazy(() => import("../components/ContentHealthDashboard"));
const RevisionHistoryViewer = lazy(() => import("../components/RevisionHistoryViewer"));
const ContentLifecycleGovernancePanel = lazy(() => import("../components/ContentLifecycleGovernancePanel"));
const RevisionComparePanel = lazy(() => import("../components/RevisionComparePanel"));
const TaxonomyManagerPanel = lazy(() => import("../components/TaxonomyManagerPanel"));
const ContentRedirectManagerPanel = lazy(() => import("../components/ContentRedirectManagerPanel"));

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
        <Suspense fallback={<LinearProgress aria-label="กำลังโหลดเครื่องมือจัดการเนื้อหา" />}>
          {section === "list" && <ContentPage />}
          {section === "editorial" && (
            <Stack spacing={2}>
              <PreviewRevisionAutosaveWorkflowGuide />
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
        </Suspense>
      </Box>
    </Stack>
  );
}
