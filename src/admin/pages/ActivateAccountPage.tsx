import { FormEvent, useEffect, useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import {
  acceptCmsInvitation,
  CmsAuthError,
  getCmsAuthErrorMessage,
  inspectCmsInvitation,
  useRetryCountdown,
  type CmsInvitationInspection
} from "../../features/cms-auth";
import AuthPageLayout from "../../design-system/components/AuthPageLayout";
import FormActions from "../../design-system/components/FormActions";

export default function ActivateAccountPage() {
  const [token, setToken] = useState("");
  const [inspection, setInspection] = useState<CmsInvitationInspection | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const { retryAfterSeconds, startRetryCountdown } = useRetryCountdown();

  useEffect(
    () => () => {
      setToken("");
      setPassword("");
      setConfirmation("");
    },
    []
  );

  async function inspectToken(event: FormEvent) {
    event.preventDefault();

    if (!token || retryAfterSeconds > 0) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      setInspection(await inspectCmsInvitation(token));
    } catch (currentError) {
      setInspection(null);
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถตรวจสอบโทเค็นเชิญได้"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptInvitation(event: FormEvent) {
    event.preventDefault();

    if (!inspection || password !== confirmation || retryAfterSeconds > 0) {
      setError(password !== confirmation ? "รหัสผ่านและการยืนยันไม่ตรงกัน" : "");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await acceptCmsInvitation({
        token,
        ...(inspection.user.username === null && username ? { username } : {}),
        password,
        passwordConfirmation: confirmation
      });
      setToken("");
      setUsername("");
      setPassword("");
      setConfirmation("");
      setInspection(null);
      setCompleted(true);
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถเปิดใช้งานบัญชีได้"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout title="เปิดใช้งานบัญชี CMS">
      <Alert severity="info">
        วางโทเค็นเชิญที่ได้รับจากผู้ดูแลระบบ โทเค็นจะไม่ถูกใส่ใน URL หรือบันทึกในเบราว์เซอร์
      </Alert>
      {error && (
        <Alert severity="error" aria-live="assertive">
          {error}
        </Alert>
      )}
      {retryAfterSeconds > 0 && (
        <Alert severity="warning" aria-live="polite">
          กรุณารอ {retryAfterSeconds} วินาทีก่อนลองอีกครั้ง
        </Alert>
      )}
      {completed ? (
        <>
          <Alert severity="success">เปิดใช้งานบัญชีสำเร็จแล้ว กรุณาเข้าสู่ระบบ</Alert>
          <Button component="a" href="/login" variant="contained">
            ไปหน้าเข้าสู่ระบบ
          </Button>
        </>
      ) : !inspection ? (
        <Stack component="form" spacing={2} onSubmit={inspectToken}>
          <TextField
            label="โทเค็นเชิญ"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            multiline
            minRows={2}
            autoComplete="off"
            disabled={submitting}
            required
            fullWidth
          />
          <FormActions
            primary={
              <Button type="submit" variant="contained" disabled={submitting || retryAfterSeconds > 0}>
                ตรวจสอบโทเค็น
              </Button>
            }
            secondary={
              <Button component="a" href="/login">
                กลับหน้าเข้าสู่ระบบ
              </Button>
            }
          />
        </Stack>
      ) : (
        <Stack component="form" spacing={2} onSubmit={acceptInvitation}>
          <Alert severity="success">โทเค็นถูกต้อง</Alert>
          <Typography>ชื่อ: {inspection.user.name}</Typography>
          <Typography>อีเมล: {inspection.user.email}</Typography>
          <Typography>บทบาท: {inspection.user.role}</Typography>
          {inspection.user.username === null ? (
            <TextField
              label="ชื่อผู้ใช้ (ไม่บังคับ)"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              disabled={submitting}
              fullWidth
            />
          ) : (
            <Typography>ชื่อผู้ใช้: {inspection.user.username}</Typography>
          )}
          <TextField
            label="รหัสผ่านใหม่"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            required
            fullWidth
          />
          <TextField
            label="ยืนยันรหัสผ่านใหม่"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            required
            fullWidth
          />
          <FormActions
            primary={
              <Button type="submit" variant="contained" disabled={submitting || retryAfterSeconds > 0}>
                เปิดใช้งานบัญชี
              </Button>
            }
            secondary={
              <Button component="a" href="/login">
                กลับหน้าเข้าสู่ระบบ
              </Button>
            }
          />
        </Stack>
      )}
    </AuthPageLayout>
  );
}
