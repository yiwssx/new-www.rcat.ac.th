import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Card, CardContent, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { getAdminWriteProvider } from "../../config/adminWriteProvider";
import { checkMediaBridgeStatus } from "../../features/cms-media/mediaBridgeClient";

export default function IntegrationsPage() {
  const structuredDataUsesCloudflare = getAdminWriteProvider() === "cloudflare";
  const bridgeQuery = useQuery({
    queryKey: ["admin-integrations", "apps-script-media-bridge-status"],
    queryFn: checkMediaBridgeStatus
  });
  const bridgeConfigured = bridgeQuery.data?.configured === true;
  const bridgeStatusError = bridgeQuery.error instanceof Error ? bridgeQuery.error.message : "";
  const bridgeSessionExpired = /admin proxy session is (?:required|invalid or expired)|identity is not allowed/i.test(
    bridgeStatusError
  );

  return (
    <Box>
      <PageHeader
        title="การเชื่อมต่อระบบ"
        description="Cloudflare จัดการข้อมูลโครงสร้าง ส่วน Apps Script และ Google Drive ทำหน้าที่เป็นสะพานสื่อและไฟล์"
      />
      {bridgeQuery.isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {bridgeQuery.isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {bridgeSessionExpired
            ? "กรุณาเข้าสู่ระบบใหม่เพื่อตรวจสอบสถานะสะพานสื่อ"
            : bridgeStatusError || "ไม่สามารถตรวจสอบ Vercel Apps Script Proxy ได้"}
        </Alert>
      )}
      {bridgeQuery.data && !bridgeConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          สะพานสื่อยังไม่พร้อม: กรุณาตรวจสอบ Vercel server environment keys: appsScriptUrlConfigured=
          {String(bridgeQuery.data.appsScriptUrlConfigured)}, bridgeTokenConfigured=
          {String(bridgeQuery.data.bridgeTokenConfigured)}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <CloudOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
                <StatusChip status={structuredDataUsesCloudflare ? "connected" : "pending"} />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                Cloudflare structured data
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                ข้อมูลเว็บไซต์และการเขียนข้อมูลโครงสร้างของผู้ดูแลทำงานผ่าน Worker และ D1
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <CloudSyncOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
                <StatusChip status={bridgeConfigured ? "connected" : "pending"} />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                Apps Script media bridge
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                เชื่อมต่อผ่าน Vercel Apps Script Proxy โดยใช้ค่าฝั่งเซิร์ฟเวอร์ ไม่ต้องเปิดเผยปลายทางต่อเบราว์เซอร์
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <DriveFolderUploadOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
                <StatusChip status={bridgeConfigured ? "connected" : "pending"} />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                Google Drive media storage
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                ไฟล์ต้นฉบับยังจัดเก็บใน Google Drive ผ่านสะพานสื่อที่จำกัดเฉพาะคำสั่งไฟล์
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2.5 }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <CloudSyncOutlinedIcon color="primary" />
            <Typography variant="h3">ช่องทางสะพานสื่อ</Typography>
          </Stack>
          <TextField
            label="โหมดการเชื่อมต่อ"
            value="เชื่อมต่อผ่าน Vercel Apps Script Proxy"
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
        </CardContent>
      </Card>
    </Box>
  );
}
