import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Card, CardContent, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import {
  checkMediaBridgeStatus,
  MediaBridgeRequestError,
  type MediaBridgeStatus
} from "../../features/cms-media/mediaBridgeClient";
import { useAuth } from "../../context/authSessionContext";
import { hasCmsCapability } from "../../features/cms-auth";

function toIntegrationStatus(status: MediaBridgeStatus["appsScriptBridge"] | undefined, requestFailed: boolean) {
  if (status === "connected") {
    return "connected" as const;
  }

  if (status === "unavailable" || requestFailed) {
    return "error" as const;
  }

  return "pending" as const;
}

export default function IntegrationsPage() {
  const { capabilities, status } = useAuth();
  const canReadMediaBridge = hasCmsCapability(capabilities, "media.read");
  const bridgeQueryEnabled = status === "authenticated" && canReadMediaBridge;
  const bridgeQuery = useQuery({
    queryKey: ["admin-integrations", "apps-script-media-bridge-status"],
    queryFn: checkMediaBridgeStatus,
    enabled: bridgeQueryEnabled
  });
  const bridgeError = bridgeQuery.error instanceof MediaBridgeRequestError ? bridgeQuery.error : null;
  const bridgeSessionExpired = bridgeError?.httpStatus === 401;
  const bridgeForbidden = (status === "authenticated" && !canReadMediaBridge) || bridgeError?.httpStatus === 403;
  const bridgeUnavailable =
    (!bridgeSessionExpired && !bridgeForbidden && bridgeQuery.isError) ||
    bridgeQuery.data?.appsScriptBridge === "unavailable" ||
    bridgeQuery.data?.driveStorage === "unavailable";
  const bridgeNotConfigured =
    bridgeQuery.data?.appsScriptBridge === "not-configured" || bridgeQuery.data?.driveStorage === "not-configured";
  const appsScriptStatus = toIntegrationStatus(bridgeQuery.data?.appsScriptBridge, bridgeQuery.isError);
  const driveStatus = toIntegrationStatus(bridgeQuery.data?.driveStorage, bridgeQuery.isError);

  return (
    <Box>
      <PageHeader
        title="การเชื่อมต่อระบบ"
        description="Cloudflare จัดการข้อมูลโครงสร้าง ส่วน Apps Script และ Google Drive ทำหน้าที่เป็นสะพานสื่อและไฟล์"
      />
      {(status === "bootstrapping" || (bridgeQueryEnabled && bridgeQuery.isLoading)) && (
        <LinearProgress sx={{ mb: 3 }} />
      )}
      {bridgeSessionExpired && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          เซสชัน CMS หมดอายุ ระบบกำลังนำกลับไปยังหน้าเข้าสู่ระบบ
        </Alert>
      )}
      {bridgeForbidden && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          บัญชีนี้ไม่มีสิทธิ์ตรวจสอบสถานะสะพานสื่อ
        </Alert>
      )}
      {bridgeNotConfigured && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          สะพานสื่อหรือพื้นที่จัดเก็บ Google Drive ยังไม่ได้กำหนดค่าฝั่งเซิร์ฟเวอร์
        </Alert>
      )}
      {bridgeUnavailable && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          ไม่สามารถตรวจสอบสถานะสะพานสื่อหรือพื้นที่จัดเก็บ Google Drive ได้ในขณะนี้
        </Alert>
      )}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "flex-start"
                }}
              >
                <CloudOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
                <StatusChip status="connected" />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                Cloudflare structured data
              </Typography>
              <Typography
                sx={{
                  color: "text.secondary",
                  mt: 0.5
                }}
              >
                ข้อมูลเว็บไซต์และการเขียนข้อมูลโครงสร้างของผู้ดูแลทำงานผ่าน Worker และ D1
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "flex-start"
                }}
              >
                <CloudSyncOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
                <StatusChip status={appsScriptStatus} />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                Apps Script media bridge
              </Typography>
              <Typography
                sx={{
                  color: "text.secondary",
                  mt: 0.5
                }}
              >
                เชื่อมต่อผ่าน Vercel Apps Script Proxy โดยใช้ค่าฝั่งเซิร์ฟเวอร์ ไม่ต้องเปิดเผยปลายทางต่อเบราว์เซอร์
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "flex-start"
                }}
              >
                <DriveFolderUploadOutlinedIcon color="primary" sx={{ fontSize: 42 }} />
                <StatusChip status={driveStatus} />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                Google Drive media storage
              </Typography>
              <Typography
                sx={{
                  color: "text.secondary",
                  mt: 0.5
                }}
              >
                ไฟล์ต้นฉบับยังจัดเก็บใน Google Drive ผ่านสะพานสื่อที่จำกัดเฉพาะคำสั่งไฟล์
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Card sx={{ mt: 2.5 }}>
        <CardContent>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: "center",
              mb: 2
            }}
          >
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
