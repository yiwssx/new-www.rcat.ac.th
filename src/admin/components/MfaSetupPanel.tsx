import { FormEvent, useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import type { CmsMfaSetup } from "../../features/cms-auth";

function readOtpAuthLabel(otpAuthUri: string) {
  try {
    const parsed = new URL(otpAuthUri);
    const accountLabel = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return {
      issuer: parsed.searchParams.get("issuer") ?? "",
      accountLabel
    };
  } catch {
    return { issuer: "", accountLabel: "" };
  }
}

export interface MfaSetupPanelProps {
  setup: CmsMfaSetup;
  onConfirm: (totpCode: string, clearSubmittedCode: () => void) => Promise<void>;
  disabled?: boolean;
  error?: string;
}

export default function MfaSetupPanel({ setup, onConfirm, disabled = false, error = "" }: MfaSetupPanelProps) {
  const [totpCode, setTotpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const labels = useMemo(() => readOtpAuthLabel(setup.otpAuthUri), [setup.otpAuthUri]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!/^[0-9]{6}$/.test(totpCode)) {
      return;
    }

    setSubmitting(true);

    try {
      await onConfirm(totpCode, () => setTotpCode(""));
      setTotpCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    await navigator.clipboard?.writeText(setup.manualEntryKey);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Typography variant="h3">ตั้งค่าแอปยืนยันตัวตน</Typography>
          <Typography
            sx={{
              color: "text.secondary"
            }}
          >
            เพิ่มบัญชีในแอปยืนยันตัวตนด้วยคีย์ด้านล่าง แล้วกรอกรหัส 6 หลักเพื่อยืนยัน
          </Typography>
          {error && (
            <Alert severity="error" aria-live="assertive">
              {error}
            </Alert>
          )}
          {labels.issuer && <Typography>ผู้ออก: {labels.issuer}</Typography>}
          {labels.accountLabel && <Typography>บัญชี: {labels.accountLabel}</Typography>}
          <TextField
            label="คีย์สำหรับกรอกด้วยตนเอง"
            value={setup.manualEntryKey}
            slotProps={{ input: { readOnly: true } }}
            fullWidth
          />
          <Button startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copyKey()} disabled={disabled}>
            คัดลอกคีย์
          </Button>
          <TextField
            label="รหัสจากแอป 6 หลัก"
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
            disabled={disabled || submitting}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={disabled || submitting || !/^[0-9]{6}$/.test(totpCode)}>
            {submitting ? "กำลังยืนยัน" : "ยืนยันการตั้งค่า"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
