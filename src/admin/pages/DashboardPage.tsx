import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
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

const adminUxWorkflowItems = [
  {
    order: 1,
    title: "Content editor / News workflow",
    description: "เริ่มจากงานข่าวและประชาสัมพันธ์ที่ผู้ดูแลเว็บใช้บ่อยที่สุด ตรวจ draft, preview, publish และข้อความผิดพลาดจากหน้างานจริง",
    href: "/admin/content",
    stage: "เริ่มก่อน"
  },
  {
    order: 2,
    title: "Media Library",
    description: "ปรับ flow รูปภาพและไฟล์สื่อให้ต่อกับการลงข่าวจริง เช่น ค้นหา เลือกใช้ อัปโหลด และตรวจไฟล์ที่ใช้ในเนื้อหา",
    href: "/admin/media",
    stage: "เริ่มก่อน"
  },
  {
    order: 3,
    title: "Document management",
    description: "จัดการเอกสารประกาศ/ดาวน์โหลดให้แยกจากสื่อทั่วไปชัดเจน ค้นหาและอัปเดตไฟล์ได้ง่ายสำหรับงานสถานศึกษา",
    href: "/admin/documents",
    stage: "เริ่มก่อน"
  },
  {
    order: 4,
    title: "Menu management",
    description: "รักษาเมนูให้ง่ายแบบ WordPress โดยเน้นลำดับ parent/child, ชื่อเมนู, URL และ preview โครงสร้างก่อนเพิ่มความสามารถใหม่",
    href: "/admin/menus",
    stage: "ถัดไป"
  },
  {
    order: 5,
    title: "Admin dashboard",
    description: "ใช้แดชบอร์ดเป็นศูนย์ควบคุมงานจริง แสดงคิวเผยแพร่ กำหนดการ และทางลัดไปยัง workflow สำคัญ",
    href: "/admin",
    stage: "กำลังใช้"
  },
  {
    order: 6,
    title: "Settings / Homepage sections",
    description: "ปรับส่วนหน้าแรกและค่าระบบหลังจากเนื้อหา/สื่อเริ่มนิ่ง เพื่อไม่ให้แก้ layout จากสมมติฐานก่อนข้อมูลจริง",
    href: "/admin/settings",
    stage: "ถัดไป"
  },
  {
    order: 7,
    title: "User role/capability UX",
    description: "ทำให้สิทธิ์ผู้ใช้เข้าใจง่ายขึ้นโดยไม่ขยาย policy ใหม่โดยไม่จำเป็น เน้นคำอธิบายและ feedback เมื่อไม่มีสิทธิ์",
    href: "/admin/users",
    stage: "รอข้อมูล"
  },
  {
    order: 8,
    title: "Audit / activity log",
    description: "เตรียมมุมมองตรวจสอบการเปลี่ยนแปลงเมื่อเริ่มมี incident หรือข้อกำหนดจากผู้บริหาร โดยยังไม่แตะ audit boundary",
    href: "/admin/backup",
    stage: "รอข้อมูล"
  },
  {
    order: 9,
    title: "Preview / revision / autosave",
    description: "ติดตามจุดเสี่ยงจากการแก้ข่าวหรือเอกสารผิด แล้วค่อยยกระดับ preview, revision และ autosave จาก pain point จริง",
    href: "/admin/content",
    stage: "รอข้อมูล"
  },
  {
    order: 10,
    title: "Mobile admin usability",
    description: "ใช้มือถือเป็นเงื่อนไขร่วมของทุก workflow โดยเฉพาะข่าว รูปภาพ เอกสาร เมนู และหน้าแรก ไม่ใช่งานท้ายสุดแยกเดี่ยว",
    href: "/admin",
    stage: "ทดสอบร่วม"
  }
] as const;

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
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
              mb: 2.5
            }}
          >
            <Box>
              <Typography variant="h3">แผนปรับ UX จากการใช้งานจริง</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                ใช้เป็นแผนที่งานหลังบ้านแบบ WordPress-like CMS: ปล่อย baseline ให้ใช้งานจริง แล้วปรับ workflow ทีละจุดจาก pain point ที่พบ
              </Typography>
            </Box>
            <Chip label="WordPress-like CMS" color="primary" variant="outlined" />
          </Stack>
          <Grid container spacing={1.5}>
            {adminUxWorkflowItems.map((item) => (
              <Grid size={{ xs: 12, md: 6, xl: 4 }} key={item.order}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardContent
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.25,
                      height: "100%"
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip label={`#${item.order}`} size="small" color={item.order <= 3 ? "primary" : "default"} />
                      <Typography sx={{ fontWeight: 900 }}>{item.title}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: "text.secondary", flexGrow: 1 }}>
                      {item.description}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", justifyContent: "space-between", mt: "auto" }}
                    >
                      <Chip label={item.stage} size="small" variant="outlined" />
                      <Button href={item.href} size="small">
                        เปิดหน้า
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
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
