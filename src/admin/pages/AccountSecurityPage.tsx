import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import {
  changeCmsPassword,
  cmsStepUpCoordinator,
  CmsAuthError,
  confirmCmsMfaSetup,
  disableCmsMfa,
  getCmsAuthErrorMessage,
  regenerateCmsRecoveryCodes,
  runCmsOperationWithStepUp,
  startCmsMfaSetup,
  type CmsMfaSetup
} from "../../features/cms-auth";
import { getCurrentAdminUserFromCloudflare } from "../../features/admin-write/cloudflareApi";
import { useAuth } from "../../context/authSessionContext";
import { useRecoveryCodeHandoff } from "../../context/RecoveryCodeHandoffContext";
import { appSwal, showSuccessResult } from "../../utils/swal";
import MfaSetupPanel from "../components/MfaSetupPanel";
import PageHeader from "../components/PageHeader";
import { formatDisplayDateTime } from "../../utils/dateDisplay";

export default function AccountSecurityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearSession, hasCapability, logout, logoutAll } = useAuth();
  const { beginRecoveryCodeHandoff } = useRecoveryCodeHandoff();
  const profileQuery = useQuery({
    queryKey: ["admin-account-security", "me"],
    queryFn: getCurrentAdminUserFromCloudflare
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [setup, setSetup] = useState<CmsMfaSetup | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableTotp, setDisableTotp] = useState("");
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("");
  const [useDisableRecovery, setUseDisableRecovery] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  useEffect(
    () => () => {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setDisablePassword("");
      setDisableTotp("");
      setDisableRecoveryCode("");
      setSetup(null);
    },
    []
  );

  async function returnToLogin() {
    clearSession({ broadcast: true });
    await queryClient.cancelQueries({ queryKey: ["admin-account-security"] });
    await navigate({ to: "/login", replace: true });
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();

    if (newPassword !== passwordConfirmation) {
      setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }

    setPendingAction("password");
    setError("");

    try {
      await changeCmsPassword(currentPassword, newPassword, passwordConfirmation);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      await showSuccessResult("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่");
      try {
        await logout();
      } catch {
        // The password-change endpoint already revoked and cleared the Session.
      }
      await navigate({ to: "/login", replace: true });
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถเปลี่ยนรหัสผ่านได้"));
    } finally {
      setPendingAction("");
    }
  }

  async function beginMfaEnrollment() {
    setPendingAction("enroll");
    setError("");

    try {
      setSetup(await runCmsOperationWithStepUp("password", () => startCmsMfaSetup("session")));
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถเริ่มตั้งค่า MFA ได้"));
    } finally {
      setPendingAction("");
    }
  }

  async function confirmMfaEnrollment(totpCode: string, clearSubmittedCode: () => void) {
    setError("");

    try {
      const result = await confirmCmsMfaSetup("session", totpCode);
      setSetup(null);
      beginRecoveryCodeHandoff({ codes: result.recoveryCodes, mode: "voluntary" });
      clearSession();
    } catch (currentError) {
      if (currentError instanceof CmsAuthError && currentError.status === 428) {
        clearSubmittedCode();
        setError("กรุณายืนยันตัวตน แล้วกรอกรหัสจากแอป 6 หลักชุดใหม่เพื่อยืนยันการตั้งค่า MFA");

        try {
          await cmsStepUpCoordinator.request("password");
        } catch {
          // Cancellation leaves setup open and never retries the submitted TOTP.
        }

        return;
      }

      setError(getCmsAuthErrorMessage(currentError, "ยืนยันการตั้งค่า MFA ไม่สำเร็จ"));
    }
  }

  async function handleRegenerateRecoveryCodes() {
    setPendingAction("regenerate");
    setError("");

    try {
      const codes = await runCmsOperationWithStepUp("mfa", regenerateCmsRecoveryCodes);
      beginRecoveryCodeHandoff({ codes, mode: "regenerated" });
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถสร้างรหัสกู้คืนชุดใหม่ได้"));
    } finally {
      setPendingAction("");
    }
  }

  async function handleDisableMfa(event: FormEvent) {
    event.preventDefault();
    const factor = useDisableRecovery ? disableRecoveryCode : disableTotp;

    if (!disablePassword || !factor) {
      setError("กรุณากรอกรหัสผ่านและหลักฐาน MFA ให้ครบถ้วน");
      return;
    }

    setPendingAction("disable");
    setError("");

    try {
      await runCmsOperationWithStepUp("mfa", () =>
        disableCmsMfa(
          useDisableRecovery
            ? { currentPassword: disablePassword, recoveryCode: disableRecoveryCode }
            : { currentPassword: disablePassword, totpCode: disableTotp }
        )
      );
      await showSuccessResult("ปิด MFA สำเร็จ กรุณาเข้าสู่ระบบใหม่");
      await returnToLogin();
    } catch (currentError) {
      setError(getCmsAuthErrorMessage(currentError, "ไม่สามารถปิด MFA ได้"));
    } finally {
      setDisablePassword("");
      setDisableTotp("");
      setDisableRecoveryCode("");
      setPendingAction("");
    }
  }

  async function handleLogoutAll() {
    const result = await appSwal.fire({
      title: "ออกจากระบบทุกเซสชัน?",
      text: "อุปกรณ์ทุกเครื่องจะต้องเข้าสู่ระบบใหม่",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบทั้งหมด",
      cancelButtonText: "ยกเลิก"
    });

    if (!result.isConfirmed) {
      return;
    }

    setPendingAction("logout-all");

    try {
      await logoutAll();
    } finally {
      await navigate({ to: "/login", replace: true });
      setPendingAction("");
    }
  }

  const profile = profileQuery.data;
  const canChangePassword = hasCapability("auth.change-password-self");
  const canManageMfa = hasCapability("auth.mfa.manage-self");
  const disableBlocked = profile?.isRoot === true || profile?.mfaRequired === true;

  return (
    <Box>
      <PageHeader title="ความปลอดภัยบัญชี" description="จัดการรหัสผ่าน MFA รหัสกู้คืน และเซสชันของบัญชีปัจจุบัน" />
      {profileQuery.isLoading && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center"
          }}
        >
          <CircularProgress size={20} />
          <Typography>กำลังโหลดข้อมูลบัญชี</Typography>
        </Stack>
      )}
      {profileQuery.isError && <Alert severity="error">ไม่สามารถโหลดข้อมูลบัญชีได้</Alert>}
      {error && !setup && (
        <Alert severity="error" aria-live="assertive" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {profile && (
        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h3">ข้อมูลบัญชีปัจจุบัน</Typography>
                <Typography>ชื่อ: {profile.name}</Typography>
                <Typography>อีเมล: {profile.email}</Typography>
                <Typography>ชื่อผู้ใช้: {profile.username ?? "ไม่ได้กำหนด"}</Typography>
                <Typography>บทบาท: {profile.role}</Typography>
                <Typography>Root: {profile.isRoot ? "ใช่" : "ไม่ใช่"}</Typography>
                <Typography>บังคับใช้ MFA: {profile.mfaRequired ? "ใช่" : "ไม่ใช่"}</Typography>
                <Typography>ตั้งค่า MFA แล้ว: {profile.mfaConfigured ? "ใช่" : "ไม่ใช่"}</Typography>
                {profile.mfaEnabledAt && (
                  <Typography>เปิดใช้ MFA: {formatDisplayDateTime(profile.mfaEnabledAt)}</Typography>
                )}
                <Typography>รหัสกู้คืนคงเหลือ: {profile.recoveryCodesRemaining ?? 0}</Typography>
                {profile.lastLoginAt && (
                  <Typography>เข้าสู่ระบบล่าสุด: {formatDisplayDateTime(profile.lastLoginAt)}</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          {setup ? (
            <MfaSetupPanel setup={setup} onConfirm={confirmMfaEnrollment} error={error} />
          ) : (
            <>
              {canChangePassword && (
                <Card>
                  <CardContent>
                    <Stack component="form" spacing={2} onSubmit={handleChangePassword}>
                      <Typography variant="h3">เปลี่ยนรหัสผ่าน</Typography>
                      <TextField
                        label="รหัสผ่านปัจจุบัน"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />
                      <TextField
                        label="รหัสผ่านใหม่"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                      />
                      <TextField
                        label="ยืนยันรหัสผ่านใหม่"
                        type="password"
                        autoComplete="new-password"
                        value={passwordConfirmation}
                        onChange={(event) => setPasswordConfirmation(event.target.value)}
                        required
                      />
                      <Button type="submit" variant="contained" disabled={Boolean(pendingAction)}>
                        เปลี่ยนรหัสผ่าน
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {canManageMfa && (
                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h3">MFA และรหัสกู้คืน</Typography>
                      {!profile.mfaConfigured ? (
                        <Button
                          variant="contained"
                          onClick={() => void beginMfaEnrollment()}
                          disabled={Boolean(pendingAction)}
                        >
                          ตั้งค่า MFA
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outlined"
                            onClick={() => void handleRegenerateRecoveryCodes()}
                            disabled={Boolean(pendingAction)}
                          >
                            สร้างรหัสกู้คืนชุดใหม่
                          </Button>
                          {disableBlocked && (
                            <Alert severity="info">
                              ไม่สามารถปิด MFA สำหรับบัญชี Root หรือบัญชีที่ถูกกำหนดให้ต้องใช้ MFA
                            </Alert>
                          )}
                          <Stack component="form" spacing={2} onSubmit={handleDisableMfa}>
                            <Typography
                              sx={{
                                fontWeight: 800
                              }}
                            >
                              ปิด MFA
                            </Typography>
                            <TextField
                              label="รหัสผ่านปัจจุบัน"
                              type="password"
                              autoComplete="current-password"
                              value={disablePassword}
                              onChange={(event) => setDisablePassword(event.target.value)}
                              disabled={disableBlocked}
                              required
                            />
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={useDisableRecovery}
                                  onChange={(event) => setUseDisableRecovery(event.target.checked)}
                                  disabled={disableBlocked}
                                />
                              }
                              label="ใช้รหัสกู้คืนแทนรหัสจากแอป"
                            />
                            <TextField
                              label={useDisableRecovery ? "รหัสกู้คืน" : "รหัสจากแอป 6 หลัก"}
                              value={useDisableRecovery ? disableRecoveryCode : disableTotp}
                              onChange={(event) =>
                                useDisableRecovery
                                  ? setDisableRecoveryCode(event.target.value)
                                  : setDisableTotp(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                              }
                              autoComplete="one-time-code"
                              disabled={disableBlocked}
                              required
                            />
                            <Button
                              type="submit"
                              color="error"
                              variant="outlined"
                              disabled={disableBlocked || Boolean(pendingAction)}
                            >
                              ปิด MFA
                            </Button>
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h3">เซสชัน</Typography>
                <Typography
                  sx={{
                    color: "text.secondary"
                  }}
                >
                  ออกจากระบบทุกอุปกรณ์และบังคับให้เข้าสู่ระบบใหม่
                </Typography>
                <Button
                  color="warning"
                  variant="outlined"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void handleLogoutAll()}
                >
                  ออกจากระบบทุกเซสชัน
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
