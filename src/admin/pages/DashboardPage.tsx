import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { designTokens } from "../../design-system/tokens";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import {
  adminDashboardSummaryQueryOptions,
  adminListQueryKeys,
  publishAllPendingAdminContent
} from "../../features/admin-pagination";
import { formatDisplayDate, formatDisplayDateTime, formatDisplayDay } from "../../utils/dateDisplay";
import { appSwal, showBlockingLoading, showErrorResult, showSuccessResult } from "../../utils/swal";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import { useAuth } from "../../context/authSessionContext";
import { ADMIN_READ_ONLY_NOTICE, canPublishContent } from "../utils/rbac";

const metricIcons = [
  <ArticleOutlinedIcon key="content" />,
  <FactCheckOutlinedIcon key="review" />,
  <DriveFolderUploadOutlinedIcon key="drive" />,
  <CloudSyncOutlinedIcon key="sync" />
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { capabilities } = useAuth();
  const canPublish = canPublishContent(capabilities);
  const { data, error, isError, isLoading, isFetching } = useQuery(adminDashboardSummaryQueryOptions());
  const publishMutation = useMutation({
    mutationFn: publishAllPendingAdminContent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminListQueryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: adminListQueryKeys.entity("content") }),
        invalidatePublicCmsData(queryClient)
      ]);
    }
  });

  const publishableCount = Math.max(0, data?.publishableCount ?? 0);
  const queue = data?.content.slice(0, 4) ?? [];
  const events = data?.events.slice(0, 3) ?? [];

  async function handlePublishQueue() {
    if (!canPublish) {
      return;
    }

    if (!publishableCount) {
      await appSwal.fire({
        icon: "info",
        title: "ไม่มีรายการให้เผยแพร่",
        text: "ไม่มีรายการรอตรวจสอบหรือรายการตั้งเวลาที่ถึงกำหนดเผยแพร่",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    const result = await appSwal.fire({
      title: "เผยแพร่คิว?",
      text: `เผยแพร่เนื้อหา ${publishableCount} รายการตอนนี้`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "เผยแพร่",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    showBlockingLoading("กำลังเผยแพร่คิว");

    try {
      const result = await publishMutation.mutateAsync();
      await appSwal.close();
      await showSuccessResult(`เผยแพร่คิวสำเร็จ ${result.publishedCount} รายการ`);
    } catch (currentError) {
      await appSwal.close();
      await showErrorResult("ไม่สามารถเผยแพร่คิวได้", currentError, "กรุณาลองอีกครั้ง");
    }
  }

  return (
    <Box>
      <PageHeader
        title="แดชบอร์ด"
        description="ภาพรวมการเผยแพร่เนื้อหา สื่อประชาสัมพันธ์ ข่าว ประกาศ กิจกรรม ฯลฯของสถานศึกษา"
        action={
          canPublish ? (
            <Button
              variant="contained"
              startIcon={<PublishOutlinedIcon />}
              disabled={publishMutation.isPending}
              onClick={() => void handlePublishQueue()}
            >
              {publishMutation.isPending ? "กำลังเผยแพร่" : "เผยแพร่คิว"}
            </Button>
          ) : undefined
        }
      />
      {!canPublish && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {ADMIN_READ_ONLY_NOTICE}
        </Alert>
      )}
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ในขณะนี้"}
        </Alert>
      )}
      {(isLoading || isFetching) && <LinearProgress sx={{ mb: 3 }} />}
      <Grid container spacing={2.5}>
        {(data?.metrics ?? []).map((metric, index) => (
          <Grid size={{ xs: 12, sm: 6, xl: 3 }} key={metric.id}>
            <MetricCard metric={metric} icon={metricIcons[index] ?? <InsightsOutlinedIcon />} />
          </Grid>
        ))}
      </Grid>
      <Card sx={{ mt: 2.5 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h3">แผนปรับ UX จากการใช้งานจริง</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              เริ่มใช้แดชบอร์ดเป็นจุดรวมแผนปรับ UX แบบ WordPress-like CMS โดยไม่เปลี่ยน backend/runtime boundary
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button href="/admin/content" variant="outlined">
                1. Content / News
              </Button>
              <Button href="/admin/media" variant="outlined">
                2. Media
              </Button>
              <Button href="/admin/documents" variant="outlined">
                3. Documents
              </Button>
              <Button href="/admin/menus" variant="outlined">
                4. Menu
              </Button>
              <Button href="/admin/settings" variant="outlined">
                5-6. Dashboard / Homepage
              </Button>
              <Button href="/admin/users" variant="outlined">
                7. Roles
              </Button>
              <Button href="/admin/backup" variant="outlined">
                8. Audit
              </Button>
              <Button href="/admin/content" variant="outlined">
                9-10. Preview / Mobile
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2
                }}
              >
                <Typography variant="h3">คิวเผยแพร่</Typography>
                <FactCheckOutlinedIcon color="primary" />
              </Stack>
              <Stack spacing={1.5}>
                {queue.map((item) => (
                  <Stack
                    key={item.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                      alignItems: { xs: "flex-start", sm: "center" },
                      justifyContent: "space-between",
                      p: 2,
                      borderRadius: designTokens.radius.medium,
                      border: "1px solid",
                      borderColor: "divider"
                    }}
                  >
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: 800
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary"
                        }}
                      >
                        {item.owner} | {formatDisplayDate(item.publishAt)}
                      </Typography>
                    </Box>
                    <StatusChip status={item.status} />
                  </Stack>
                ))}
                {!queue.length && (
                  <Typography
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    ไม่มีรายการรอตรวจสอบหรือรายการตั้งเวลาที่ถึงกำหนดเผยแพร่
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2
                }}
              >
                <Typography variant="h3">กำหนดการที่กำลังจะมาถึง</Typography>
                <EventAvailableOutlinedIcon color="secondary" />
              </Stack>
              <Stack spacing={2}>
                {events.map((event) => (
                  <Stack key={event.id} direction="row" spacing={2}>
                    <Box
                      sx={{
                        width: 62,
                        height: 62,
                        borderRadius: designTokens.radius.medium,
                        display: "grid",
                        placeItems: "center",
                        color: "secondary.dark",
                        backgroundColor: "secondary.light",
                        flex: "0 0 auto"
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 900
                        }}
                      >
                        {formatDisplayDay(event.date)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography
                        sx={{
                          fontWeight: 800
                        }}
                      >
                        {event.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary"
                        }}
                      >
                        {event.audience} | {formatDisplayDateTime(event.date)}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
                {!events.length && (
                  <Typography
                    sx={{
                      color: "text.secondary"
                    }}
                  >
                    ยังไม่มีกิจกรรมที่กำลังจะมาถึง
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
