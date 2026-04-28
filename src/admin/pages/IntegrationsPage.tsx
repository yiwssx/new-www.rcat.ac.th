import {
  useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { getGoogleAppsScriptUrl, projectSettings } from "../../config/projectSettings";
import { checkGoogleConnection } from "../../services/googleApi";
import { IntegrationStatus } from "../../types";
import { formatDisplayDateTime } from "../../utils/dateDisplay";
import { integrationServiceLabels } from "../../utils/thaiLabels";

function getIntegrationIcon(service: IntegrationStatus["service"]) {
  if (service === "Sheets") {
    return <TableChartOutlinedIcon />;
  }

  if (service === "Drive") {
    return <DriveFolderUploadOutlinedIcon />;
  }

  return <DescriptionOutlinedIcon />;
}

export default function IntegrationsPage() {
  const endpoint = getGoogleAppsScriptUrl();
  const { data = [], error, isError, isLoading } = useQuery({
    queryKey: ["google-integrations"],
    queryFn: checkGoogleConnection
  });

  return (
    <Box>
      <PageHeader
        title="Google APIs"
        description="สถานะการเชื่อมต่อสำหรับเนื้อหาใน Sheets สื่อใน Drive และร่างเอกสารใน Docs"
      />
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "ไม่สามารถตรวจสอบสถานะ Google Apps Script ได้"}
        </Alert>
      )}
      <Grid container spacing={2.5}>
        {data.map((integration) => (
          <Grid size={{ xs: 12, md: 4 }} key={integration.service}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box
                    sx={{
                      width: 54,
                      height: 54,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      color: "primary.main",
                      backgroundColor: "primary.light"
                    }}
                  >
                    {getIntegrationIcon(integration.service)}
                  </Box>
                  <StatusChip status={integration.status} />
                </Stack>
                <Typography variant="h3" sx={{ mt: 2 }}>
                  {integrationServiceLabels[integration.service] ?? integration.service}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {integration.detail}
                </Typography>
                <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
                  ซิงก์ล่าสุด:{" "}
                  {integration.lastSync === "Not connected"
                    ? "ยังไม่เชื่อมต่อ"
                    : formatDisplayDateTime(integration.lastSync)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card sx={{ mt: 2.5 }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <CloudSyncOutlinedIcon color="primary" />
            <Typography variant="h3">ปลายทาง Apps Script</Typography>
          </Stack>
          <TextField
            label="ปลายทาง"
            value={endpoint || `ยังไม่ได้ตั้งค่า ${projectSettings.api.googleAppsScriptUrlEnv}`}
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
        </CardContent>
      </Card>
    </Box>
  );
}
