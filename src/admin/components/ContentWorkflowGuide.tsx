import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useAuth } from "../../context/authSessionContext";
import { invalidateAdminListQueries } from "../../features/admin-pagination";
import { CmsAuthError } from "../../features/cms-auth";
import { backfillLegacyFacebookThumbnails } from "../../features/cms-content";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import {
  appSwal,
  showBlockingLoading,
  showErrorResult,
  showSuccessResult,
  updateBlockingLoading
} from "../../utils/swal";

const contentWorkflowSteps = [
  {
    title: "1. เขียนฉบับร่าง",
    status: "Draft",
    description: "ใส่ชื่อเรื่อง สรุป เนื้อหา รูป หมวดหมู่ และแท็ก"
  },
  {
    title: "2. ตรวจทานก่อนเผยแพร่",
    status: "Review",
    description: "ตรวจข้อความ ลิงก์ ผู้รับผิดชอบ วันที่ และสื่อที่แนบ"
  },
  {
    title: "3. เผยแพร่หรือกำหนดเวลา",
    status: "Publish / Schedule",
    description: "เผยแพร่ทันทีหรือกำหนดเวลา แล้วตรวจหน้าสาธารณะ"
  }
] as const;

export default function ContentWorkflowGuide() {
  const queryClient = useQueryClient();
  const { hasCapability } = useAuth();
  const canRepairLegacyThumbnails = hasCapability("content.update") && hasCapability("media.manage");
  const backfillMutation = useMutation({
    mutationFn: backfillLegacyFacebookThumbnails
  });

  async function handleLegacyThumbnailRepair() {
    if (!canRepairLegacyThumbnails || backfillMutation.isPending) {
      return;
    }

    const confirmation = await appSwal.fire({
      icon: "question",
      title: "ซ่อมภาพย่อ Facebook เก่า?",
      text: "ระบบจะตรวจเฉพาะเนื้อหาที่เผยแพร่แล้วและยังไม่มีรูป โดยคัดลอกรูปตัวอย่าง Facebook เข้า Google Drive เดิม",
      showCancelButton: true,
      confirmButtonText: "เริ่มซ่อม",
      cancelButtonText: "ยกเลิก"
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    showBlockingLoading("กำลังซ่อมภาพย่อ Facebook เก่า", "กำลังตรวจรายการที่ต้องซ่อม...");

    try {
      const result = await backfillMutation.mutateAsync({
        concurrency: 5,
        onProgress: (progress) => {
          if (progress.phase === "scanning") {
            updateBlockingLoading(
              "กำลังตรวจโพสต์ Facebook เก่า",
              `ตรวจแล้ว ${progress.scanned} รายการ พบผู้สมัครซ่อม ${progress.candidates} รายการ`
            );
            return;
          }

          updateBlockingLoading(
            "กำลังซ่อมภาพย่อ Facebook เก่า",
            `ดำเนินการ ${progress.completed}/${progress.candidates} รายการ • สำเร็จ ${progress.repaired} • ข้าม ${progress.skipped} • ล้มเหลว ${progress.failed}`
          );
        }
      });
      await Promise.all([invalidateAdminListQueries(queryClient, "content"), invalidatePublicCmsData(queryClient)]);
      await appSwal.close();

      const summary = `ตรวจ ${result.scanned} รายการ พบที่ต้องตรวจละเอียด ${result.candidates} รายการ ซ่อมสำเร็จ ${result.repaired} รายการ ข้าม ${result.skipped} รายการ ล้มเหลว ${result.failed} รายการ`;

      if (result.failed > 0) {
        await appSwal.fire({
          icon: "warning",
          title: "ซ่อมภาพย่อเสร็จบางส่วน",
          text: summary,
          confirmButtonText: "ตกลง"
        });
      } else {
        await showSuccessResult("ซ่อมภาพย่อ Facebook เก่าเรียบร้อย", summary);
      }
    } catch (error) {
      await appSwal.close();

      if (error instanceof CmsAuthError && [401, 403, 428].includes(error.status)) {
        await appSwal.fire({
          icon: "warning",
          title: "เซสชัน CMS หมดอายุ",
          text: "กรุณาเข้าสู่ระบบหรือยืนยันตัวตนใหม่ แล้วกดซ่อมอีกครั้ง ระบบจะข้ามโพสต์ที่ซ่อมสำเร็จแล้วและทำต่อเฉพาะรายการที่เหลือ",
          confirmButtonText: "ตกลง"
        });
        return;
      }

      await showErrorResult("ไม่สามารถซ่อมภาพย่อ Facebook เก่าได้", error, "กรุณาลองใหม่อีกครั้ง");
    }
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>ลำดับงานเขียนข่าวแบบ WordPress-like</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              ใช้เป็นเช็กลิสต์ก่อนเปิดตัวแก้ไข เพื่อไม่ข้ามขั้นตอนสำคัญ
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {contentWorkflowSteps.map((step) => (
              <Box
                key={step.title}
                sx={{
                  flex: 1,
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.default"
                }}
              >
                <Stack spacing={0.75}>
                  <Chip
                    label={step.status}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ alignSelf: "start" }}
                  />
                  <Typography sx={{ fontWeight: 900 }}>{step.title}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {step.description}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
          {canRepairLegacyThumbnails && (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={backfillMutation.isPending}
                  onClick={() => void handleLegacyThumbnailRepair()}
                >
                  ซ่อมภาพย่อ Facebook เก่า
                </Button>
              }
            >
              สำหรับโพสต์ Facebook ที่เผยแพร่ก่อนระบบสร้างภาพย่ออัตโนมัติ และยังแสดงเป็นไอคอนโทรโข่ง
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
