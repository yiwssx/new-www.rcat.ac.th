import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
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
import { getCmsSnapshot, publishContent } from "../services/googleApi";
import { formatDisplayDate, formatDisplayDateTime } from "../utils/dateDisplay";
import { appSwal } from "../utils/swal";

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
        title: "Nothing to publish",
        text: "There are no draft, review, or scheduled items in the queue.",
        confirmButtonText: "OK"
      });
      return;
    }

    const result = await appSwal.fire({
      title: "Publish queue?",
      text: `Publish ${pendingItems.length} content item${pendingItems.length === 1 ? "" : "s"} now.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Publish",
      cancelButtonText: "Cancel"
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
        title: "Queue published",
        showConfirmButton: false,
        timer: 1400,
        timerProgressBar: true
      });
    } catch (currentError) {
      await appSwal.fire({
        icon: "error",
        title: "Unable to publish queue",
        text: currentError instanceof Error ? currentError.message : "Please try again.",
        confirmButtonText: "OK"
      });
    }
  }

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        description="Publishing overview for admissions, programs, announcements, and campus media."
        action={
          <Button
            variant="contained"
            startIcon={<PublishOutlinedIcon />}
            disabled={publishMutation.isPending}
            onClick={() => void handlePublishQueue()}
          >
            {publishMutation.isPending ? "Publishing" : "Publish queue"}
          </Button>
        }
      />
      {isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error instanceof Error ? error.message : "Unable to load dashboard data right now."}
        </Alert>
      )}
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Grid container spacing={2.5}>
        {(snapshot?.metrics ?? []).map((metric, index) => (
          <Grid item xs={12} sm={6} xl={3} key={metric.id}>
            <MetricCard metric={metric} icon={metricIcons[index] ?? <InsightsOutlinedIcon />} />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h3">Publishing queue</Typography>
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
                  <Typography color="text.secondary">No draft, review, or scheduled items are waiting.</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="h3">Upcoming dates</Typography>
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
                {!events.length && <Typography color="text.secondary">No upcoming events are available.</Typography>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
