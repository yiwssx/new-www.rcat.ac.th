import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { getAdminCmsSnapshotFromCloudflare } from "../../features/admin-write/cloudflareApi";
import {
  evaluateContentHealth,
  type ContentHealthIssueCode
} from "../../features/cms-governance/contentHealth";
import { CONTENT_GOVERNANCE_OPTIONS_QUERY } from "./EditorialWorkflowPanel";

const issueLabels: Record<ContentHealthIssueCode, string> = {
  "missing-summary": "ขาดคำโปรย",
  "missing-body": "เนื้อหาว่าง",
  "missing-owner": "ขาดผู้รับผิดชอบ",
  "missing-seo": "SEO ไม่ครบ",
  "missing-media": "สื่ออ้างอิงหาย",
  "missing-image-alt": "รูปไม่มี Alt text",
  "stale-editorial-item": "ฉบับร่างค้างนาน"
};

export default function ContentHealthDashboard() {
  const snapshotQuery = useQuery({
    queryKey: CONTENT_GOVERNANCE_OPTIONS_QUERY,
    queryFn: getAdminCmsSnapshotFromCloudflare,
    staleTime: 30_000
  });

  const report = snapshotQuery.data
    ? evaluateContentHealth(snapshotQuery.data.content ?? [], snapshotQuery.data.media ?? [])
    : null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
              Content Health Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              ตรวจความพร้อมของเนื้อหา สื่อ SEO การเข้าถึง และฉบับร่างที่ค้างนานจากข้อมูล CMS ปัจจุบัน
            </Typography>
          </Box>

          {snapshotQuery.isLoading && <Typography>กำลังประเมินสุขภาพเนื้อหา…</Typography>}
          {snapshotQuery.isError && <Alert severity="warning">ไม่สามารถประเมินสุขภาพเนื้อหาได้ในขณะนี้</Alert>}

          {report && (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip label={`ทั้งหมด ${report.totalContent}`} />
                <Chip label={`สมบูรณ์ ${report.healthyContent}`} color="success" variant="outlined" />
                <Chip
                  label={`ประเด็นที่ควรตรวจ ${report.issueCount}`}
                  color={report.issueCount ? "warning" : "success"}
                  variant="outlined"
                />
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {(Object.entries(report.issueCounts) as Array<[ContentHealthIssueCode, number]>)
                  .filter(([, count]) => count > 0)
                  .map(([code, count]) => (
                    <Chip key={code} size="small" label={`${issueLabels[code]} ${count}`} variant="outlined" />
                  ))}
              </Stack>

              {report.issueCount === 0 ? (
                <Alert severity="success">ไม่พบประเด็นสุขภาพเนื้อหาจากเกณฑ์ที่ตรวจในรอบนี้</Alert>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {report.issues.slice(0, 12).map((issue, index) => (
                    <Box key={`${issue.contentId}-${issue.code}-${index}`} sx={{ py: 1.25 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                        <Chip label={issueLabels[issue.code]} size="small" color="warning" variant="outlined" />
                        <Typography sx={{ fontWeight: 800 }}>{issue.title}</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        {issue.detail}
                      </Typography>
                    </Box>
                  ))}
                  {report.issues.length > 12 && (
                    <Typography variant="body2" sx={{ color: "text.secondary", pt: 1.25 }}>
                      และอีก {report.issues.length - 12} ประเด็น
                    </Typography>
                  )}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
