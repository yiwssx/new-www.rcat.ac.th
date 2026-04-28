import {
  useMemo } from "react";
import { useMutation,
  useQuery,
  useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import dayjs from "dayjs";
import MetricCard from "../components/MetricCard";
import PageHeader from "../components/PageHeader";
import StatusChip from "../components/StatusChip";
import { getCmsSnapshot, publishContent } from "../../services/googleApi";
import { formatDisplayDate, formatDisplayDateTime } from "../../utils/dateDisplay";
import { appSwal } from "../../utils/swal";

const metricIcons = [
  <ArticleOutlinedIcon key="content" />,
  <FactCheckOutlinedIcon key="review" />,
  <DriveFolderUploadOutlinedIcon key="drive" />,
  <CloudSyncOutlinedIcon key="sync" />
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });
  const publishMutation = useMutation({
    mutationFn: publishContent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
    }
  });

  const snapshot = data;
  const pendingItems = useMemo(
    () => snapshot?.content.filter((item) => item.status !== "published") ?? [],
    [snapshot]
  );
  const queue = useMemo(() => pendingItems.slice(0, 4), [pendingItems]);
  const events = snapshot?.events.filter((event) => event.status !== "cancelled").slice(0, 3) ?? [];

  async function handlePublishQueue() {
    if (!pendingItems.length) {
      await appSwal.fire({
        icon: "info",
        title: "ไม่มีรายการให้เผยแพร่",
        text: "ไม่มีฉบับร่าง รายการรอตรวจสอบ หรือรายการตั้งเวลาในคิว",
        confirmButtonText: "ตกลง"
      });
      return;
    }

    const result = await appSwal.fire({
      title: "เผยแพร่คิว?",
      text: `เผยแพร่เนื้อหา ${pendingItems.length} รายการตอนนี้`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "เผยแพร่",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      for (const item of pendingItems) {
        await publishMutation.mutateAsync(item.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["cms-snapshot"] });
      await appSwal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "เผยแพร่คิวแล้ว",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "ไม่สามารถเผยแพร่คิวได้",
        text: currentError instanceof Error ? currentError.message : "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="แดชบอร์ด"
        description="ภาพรวมการเผยแพร่เนื้อหา สื่อประชาสัมพันธ์ ข่าว ประกาศ กิจกรรม ฯลฯของสถานศึกษา"
        action={
          <Button
            variant="contained"
            startIcon={<PublishOutlinedIcon />}
            disabled={publishMutation.isPending}
            onClick={() => void handlePublishQueue()}
          >
            {publishMutation.isPending ? "กำลังเผยแพร่" : "เผยแพร่คิว"}
          </Button>
        }
      />
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ในขณะนี้"}
        </Alert>
      )}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Grid container spacing={2.5}>
        {(snapshot?.metrics ?? []).map((metric, index) => (
          <Grid size={{ xs: 12, sm: 6, xl: 3 }} key={metric.id}>
            <MetricCard metric={metric} icon={metricIcons[index] ?? <InsightsOutlinedIcon />} />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h3">คิวเผยแพร่</Typography>
                <FactCheckOutlinedIcon color="primary" />
              </Stack>
              <Stack spacing={1.5}>
                {queue.map((item) => (
                  <Stack
                    key={item.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid rgba(31, 90, 44, 0.12)"
                    }}
                  >
                    <Box>
                      <Typography fontWeight={800}>{item.title}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {item.owner} | {formatDisplayDate(item.publishAt)}
                      </Typography>
                    </Box>
                    <StatusChip status={item.status} />
                  </Stack>
                ))}
                {!queue.length && (
                  <Typography color="text.secondary">ไม่มีฉบับร่าง รายการรอตรวจสอบ หรือรายการตั้งเวลาที่รออยู่</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
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
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        color: "secondary.dark",
                        backgroundColor: "secondary.light",
                        flex: "0 0 auto"
                      }}
                    >
                      <Typography fontWeight={900}>{dayjs(event.date).format("DD")}</Typography>
                    </Box>
                    <Box>
                      <Typography fontWeight={800}>{event.title}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {event.audience} | {formatDisplayDateTime(event.date)}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
                {!events.length && <Typography color="text.secondary">ยังไม่มีกิจกรรมที่กำลังจะมาถึง</Typography>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
