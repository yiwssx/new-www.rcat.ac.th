import { LinearProgress, Stack, Typography } from "@mui/material";
import type { MediaUploadProgress } from "../../features/cms-media";
import { formatFileSize } from "../../utils/files";

interface MediaUploadProgressFeedbackProps {
  preparing: boolean;
  progress: MediaUploadProgress | null;
}

export default function MediaUploadProgressFeedback({ preparing, progress }: MediaUploadProgressFeedbackProps) {
  const percent = progress?.percent ?? 0;
  const complete = !preparing && percent >= 100;
  const label = preparing
    ? "กำลังเตรียมไฟล์สำหรับอัปโหลด"
    : complete
      ? "อัปโหลดครบ 100% กำลังบันทึกข้อมูล"
      : "กำลังอัปโหลดไฟล์ไปยัง Drive และบันทึกข้อมูล";

  return (
    <Stack spacing={0.8} role="status" aria-live="polite" aria-busy="true">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ color: "text.secondary" }}>{label}</Typography>
        {!preparing && <Typography sx={{ fontWeight: 900, minWidth: 48, textAlign: "right" }}>{percent}%</Typography>}
      </Stack>
      <LinearProgress
        variant={preparing ? "indeterminate" : "determinate"}
        value={preparing ? undefined : percent}
        aria-label={preparing ? "กำลังเตรียมไฟล์" : `ความคืบหน้าการอัปโหลด ${percent}%`}
        sx={{ height: 8, borderRadius: 999 }}
      />
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {preparing
          ? "กำลังอ่านและเตรียมข้อมูลไฟล์ กรุณาอย่าปิดหน้านี้"
          : progress
            ? `${formatFileSize(progress.uploadedBytes)} / ${formatFileSize(progress.totalBytes)}`
            : "กำลังเริ่มการอัปโหลด"}
      </Typography>
    </Stack>
  );
}
