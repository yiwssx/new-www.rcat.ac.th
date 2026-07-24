import { FormEvent, useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography } from "@mui/material";
import {
  CmsAuthError,
  completeCmsPasswordReset,
  getCmsAuthErrorMessage,
  inspectCmsPasswordReset,
  useRetryCountdown,
  type CmsPasswordResetInspection
} from "../../features/cms-auth";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [inspection, setInspection] = useState<CmsPasswordResetInspection | null>(null);
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
      setInspection(await inspectCmsPasswordReset(token));
    } catch (currentError) {
      setInspection(null);
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถตรวจสอบโทเค็นตั้งรหัสผ่านใหม่ได้"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function completeReset(event: FormEvent) {
    event.preventDefault();

    if (!inspection || password !== confirmation || retryAfterSeconds > 0) {
      setError(password !== confirmation ? "รหัสผ่านและการยืนยันไม่ตรงกัน" : "");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await completeCmsPasswordReset(token, password, confirmation);
      setToken("");
      setPassword("");
      setConfirmation("");
      setInspection(null);
      setCompleted(true);
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถตั้งรหัสผ่านใหม่ได้"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Container maxWidth="sm">
        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h1" sx={{ fontSize: "1.75rem" }}>
                ตั้งรหัสผ่านใหม่
              </Typography>
              <Alert severity="info">
                ต้องได้รับโทเค็นตั้งรหัสผ่านใหม่จากผู้ดูแลระบบที่ได้รับอนุญาต ระบบยังไม่มีบริการส่งอีเมลอัตโนมัติ
                และจะไม่ใส่โทเค็นใน URL
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
                  <Alert severity="success">ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเข้าสู่ระบบ</Alert>
                  <Button component="a" href="/login" variant="contained">
                    ไปหน้าเข้าสู่ระบบ
                  </Button>
                </>
              ) : !inspection ? (
                <Stack component="form" spacing={2} onSubmit={inspectToken}>
                  <TextField
                    label="โทเค็นตั้งรหัสผ่านใหม่"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    multiline
                    minRows={2}
                    autoComplete="off"
                    disabled={submitting}
                    required
                    fullWidth
                  />
                  <Button type="submit" variant="contained" disabled={submitting || retryAfterSeconds > 0}>
                    ตรวจสอบโทเค็น
                  </Button>
                  <Button component="a" href="/login">
                    กลับหน้าเข้าสู่ระบบ
                  </Button>
                </Stack>
              ) : (
                <Stack component="form" spacing={2} onSubmit={completeReset}>
                  <Alert severity="success">โทเค็นถูกต้องสำหรับบัญชี {inspection.user.emailHint}</Alert>
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
                  <Button type="submit" variant="contained" disabled={submitting || retryAfterSeconds > 0}>
                    ตั้งรหัสผ่านใหม่
                  </Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
