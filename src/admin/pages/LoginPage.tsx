import { FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import { getCmsSiteName } from "../../config/projectSettings";
import { useAuth } from "../../context/authSessionContext";
import { useRecoveryCodeHandoff } from "../../context/RecoveryCodeHandoffContext";
import {
  CmsAuthError,
  confirmCmsMfaSetup,
  consumeCmsSessionNotice,
  getCmsAuthErrorMessage,
  startCmsMfaSetup,
  useRetryCountdown,
  type CmsMfaSetup
} from "../../features/cms-auth";
import { appSwal } from "../../utils/swal";
import MfaSetupPanel from "../components/MfaSetupPanel";

type LoginStep = "password" | "mfa" | "enrollment" | "completed";

function LoginAvailabilityState({ unavailable = false, onRetry }: { unavailable?: boolean; onRetry?: () => void }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.primary.light} 44%, ${theme.palette.secondary.light} 100%)`,
        px: 2,
        py: 5
      }}
    >
      <Container maxWidth="sm">
        <Card className="rcat-admin-card">
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SchoolOutlinedIcon color="primary" />
                <Typography variant="h1" sx={{ fontSize: "1.75rem" }}>
                  {getCmsSiteName()}
                </Typography>
              </Stack>
              {unavailable ? (
                <>
                  <Alert severity="warning">ระบบยืนยันตัวตน CMS ไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง</Alert>
                  <Button variant="contained" onClick={onRetry}>
                    ลองใหม่
                  </Button>
                </>
              ) : (
                <>
                  <Typography>กำลังตรวจสอบเซสชัน CMS</Typography>
                  <LinearProgress aria-label="กำลังตรวจสอบเซสชัน CMS" />
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, refreshSession, status, verifyMfa } = useAuth();
  const { beginRecoveryCodeHandoff } = useRecoveryCodeHandoff();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const noticeConsumedRef = useRef(false);
  const [step, setStep] = useState<LoginStep>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [factorType, setFactorType] = useState<"totp" | "recovery">("totp");
  const [factorValue, setFactorValue] = useState("");
  const [setup, setSetup] = useState<CmsMfaSetup | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const { retryAfterSeconds, startRetryCountdown } = useRetryCountdown();

  useEffect(
    () => () => {
      setPassword("");
      setFactorValue("");
      setSetup(null);
    },
    []
  );

  useEffect(() => {
    if (!noticeConsumedRef.current) {
      noticeConsumedRef.current = true;
      setSessionNotice(consumeCmsSessionNotice());
    }
  }, []);

  useEffect(() => {
    if (step === "password") {
      window.setTimeout(() => passwordInputRef.current?.focus(), 0);
    }
  }, [step]);

  if (status === "authenticated") {
    return <Navigate to="/admin" replace />;
  }

  if (status === "bootstrapping") {
    return <LoginAvailabilityState />;
  }

  if (status === "unavailable") {
    return <LoginAvailabilityState unavailable onRetry={() => void refreshSession().catch(() => undefined)} />;
  }

  async function beginEnrollment() {
    setSubmitting(true);
    setError("");

    try {
      setSetup(await startCmsMfaSetup("challenge"));
      setStep("enrollment");
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถเริ่มตั้งค่า MFA ได้"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();

    if (retryAfterSeconds > 0) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await login(identifier, password);
      setPassword("");

      if (result.kind === "authenticated") {
        setStep("completed");
        await appSwal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ",
          showConfirmButton: false,
          timer: 1200
        });
        await navigate({ to: "/admin", replace: true });
        return;
      }

      if (result.enrollmentRequired) {
        await beginEnrollment();
      } else {
        setStep("mfa");
      }
    } catch (currentError) {
      setPassword("");
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถเข้าสู่ระบบได้"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();

    if (retryAfterSeconds > 0 || (factorType === "totp" && !/^[0-9]{6}$/.test(factorValue))) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await verifyMfa(factorType === "totp" ? { totpCode: factorValue } : { recoveryCode: factorValue });
      setFactorValue("");
      setStep("completed");
      await navigate({ to: "/admin", replace: true });
    } catch (currentError) {
      setFactorValue("");
      setError(getCmsAuthErrorMessage(currentError, "ยืนยัน MFA ไม่สำเร็จ"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnrollmentConfirm(totpCode: string) {
    setError("");

    try {
      const result = await confirmCmsMfaSetup("challenge", totpCode);
      setSetup(null);
      setStep("completed");
      beginRecoveryCodeHandoff({ codes: result.recoveryCodes, mode: "mandatory" });
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ยืนยันการตั้งค่า MFA ไม่สำเร็จ"));
      if (currentError instanceof CmsAuthError) {
        startRetryCountdown(currentError.retryAfterSeconds);
      }
    }
  }

  function restartLogin() {
    setStep("password");
    setPassword("");
    setFactorValue("");
    setFactorType("totp");
    setSetup(null);
    setError("");
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.primary.light} 44%, ${theme.palette.secondary.light} 100%)`,
        px: 2,
        py: 5
      }}
    >
      <Container maxWidth="sm">
        <Card className="rcat-admin-card">
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    backgroundColor: "primary.light"
                  }}
                >
                  <SchoolOutlinedIcon />
                </Box>
                <Box>
                  <Typography variant="h1" sx={{ fontSize: "1.75rem" }}>
                    {getCmsSiteName()}
                  </Typography>
                  <Typography color="text.secondary">ระบบบริหารจัดการเนื้อหา</Typography>
                </Box>
              </Stack>

              {sessionNotice && <Alert severity="warning">{sessionNotice}</Alert>}
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

              {step === "password" && (
                <Stack component="form" spacing={2.25} onSubmit={handlePasswordSubmit}>
                  <TextField
                    label="อีเมลหรือชื่อผู้ใช้"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    disabled={submitting}
                    required
                    fullWidth
                  />
                  <TextField
                    inputRef={passwordInputRef}
                    label="รหัสผ่าน"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={submitting}
                    required
                    fullWidth
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting || retryAfterSeconds > 0}
                    startIcon={<LoginOutlinedIcon />}
                  >
                    {submitting ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
                  </Button>
                  {submitting && <LinearProgress />}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button component="a" href="/activate-account">
                      เปิดใช้งานบัญชี
                    </Button>
                    <Button component="a" href="/reset-password">
                      ตั้งรหัสผ่านใหม่ด้วยโทเค็น
                    </Button>
                  </Stack>
                </Stack>
              )}

              {step === "mfa" && (
                <Stack component="form" spacing={2} onSubmit={handleMfaSubmit}>
                  <Typography variant="h3">ยืนยัน MFA</Typography>
                  <FormControl>
                    <FormLabel>เลือกวิธียืนยัน</FormLabel>
                    <RadioGroup
                      row
                      value={factorType}
                      onChange={(event) => {
                        setFactorType(event.target.value as "totp" | "recovery");
                        setFactorValue("");
                      }}
                    >
                      <FormControlLabel value="totp" control={<Radio />} label="รหัสจากแอป" />
                      <FormControlLabel value="recovery" control={<Radio />} label="รหัสกู้คืน" />
                    </RadioGroup>
                  </FormControl>
                  <TextField
                    label={factorType === "totp" ? "รหัส 6 หลัก" : "รหัสกู้คืน"}
                    value={factorValue}
                    onChange={(event) =>
                      setFactorValue(
                        factorType === "totp"
                          ? event.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                          : event.target.value
                      )
                    }
                    autoComplete="one-time-code"
                    slotProps={{
                      htmlInput: { inputMode: factorType === "totp" ? "numeric" : "text" }
                    }}
                    disabled={submitting}
                    required
                    fullWidth
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      submitting || retryAfterSeconds > 0 || (factorType === "totp" && !/^[0-9]{6}$/.test(factorValue))
                    }
                  >
                    {submitting ? "กำลังยืนยัน" : "ยืนยันและเข้าสู่ระบบ"}
                  </Button>
                  <Button onClick={restartLogin} disabled={submitting}>
                    เริ่มเข้าสู่ระบบใหม่
                  </Button>
                </Stack>
              )}

              {step === "enrollment" &&
                (setup ? (
                  <MfaSetupPanel
                    setup={setup}
                    onConfirm={handleEnrollmentConfirm}
                    disabled={retryAfterSeconds > 0}
                    error={error}
                  />
                ) : (
                  <Button
                    variant="contained"
                    onClick={() => void beginEnrollment()}
                    disabled={submitting || retryAfterSeconds > 0}
                  >
                    ลองเริ่มตั้งค่า MFA อีกครั้ง
                  </Button>
                ))}

              {step !== "password" && step !== "completed" && (
                <Button onClick={restartLogin} disabled={submitting}>
                  กลับไปกรอกรหัสผ่าน
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
