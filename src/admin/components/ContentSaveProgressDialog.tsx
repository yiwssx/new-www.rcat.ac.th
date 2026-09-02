import { Box, Dialog, DialogContent, LinearProgress, Stack, Typography } from "@mui/material";

export interface ContentSaveProgressDisplay {
  percent: number;
  message: string;
}

interface ContentSaveProgressDialogProps {
  progress: ContentSaveProgressDisplay | null;
}

export default function ContentSaveProgressDialog({ progress }: ContentSaveProgressDialogProps) {
  const percent = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)));

  return (
    <Dialog
      open={Boolean(progress)}
      fullWidth
      maxWidth="xs"
      disableEscapeKeyDown
      aria-labelledby="content-save-progress-title"
      aria-describedby="content-save-progress-message"
    >
      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
            <Typography id="content-save-progress-title" sx={{ fontWeight: 900 }}>
              กำลังบันทึกเนื้อหา
            </Typography>
            <Typography sx={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{percent}%</Typography>
          </Stack>
          <Box>
            <LinearProgress
              variant="determinate"
              value={percent}
              aria-label="ความคืบหน้าการบันทึกเนื้อหา"
              aria-valuetext={`${percent}%`}
              sx={{ height: 10, borderRadius: 999 }}
            />
          </Box>
          <Typography id="content-save-progress-message" aria-live="polite" sx={{ color: "text.secondary" }}>
            {progress?.message ?? "กำลังเตรียมการบันทึก"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            กรุณารอจนกว่าการบันทึกและการเตรียมภาพย่อจะเสร็จสิ้น
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
