import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useAuth } from "../../context/authSessionContext";
import { cmsStepUpCoordinator, getCmsAuthErrorMessage } from "../../features/cms-auth";

export default function ReauthenticationDialog() {
  const { reauthenticate } = useAuth();
  const snapshot = useSyncExternalStore(
    cmsStepUpCoordinator.subscribe,
    cmsStepUpCoordinator.getSnapshot,
    cmsStepUpCoordinator.getSnapshot
  );
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [factorType, setFactorType] = useState<"totp" | "recovery">("totp");
  const [factorValue, setFactorValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (snapshot.open) {
      window.setTimeout(() => passwordInputRef.current?.focus(), 0);
    }
  }, [snapshot.open]);

  function clearForm() {
    setCurrentPassword("");
    setFactorType("totp");
    setFactorValue("");
    setError("");
    setSubmitting(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!currentPassword || (snapshot.assurance === "mfa" && !factorValue)) {
      setError("กรุณากรอกข้อมูลยืนยันตัวตนให้ครบถ้วน");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await reauthenticate({
        currentPassword,
        ...(snapshot.assurance === "mfa"
          ? factorType === "totp"
            ? { totpCode: factorValue }
            : { recoveryCode: factorValue }
          : {})
      });
      clearForm();
      cmsStepUpCoordinator.complete();
    } catch (currentError) {
      if (cmsStepUpCoordinator.getSnapshot().open) {
        setError(getCmsAuthErrorMessage(currentError, "ยืนยันตัวตนไม่สำเร็จ กรุณาลองอีกครั้ง"));
      } else {
        clearForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    if (!submitting) {
      clearForm();
      cmsStepUpCoordinator.cancel();
    }
  }

  return (
    <Dialog open={snapshot.open} onClose={handleCancel} fullWidth maxWidth="xs">
      <Stack component="form" onSubmit={handleSubmit}>
        <DialogTitle>ยืนยันตัวตนอีกครั้ง</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">การดำเนินการนี้มีความสำคัญ กรุณายืนยันตัวตนก่อนดำเนินการต่อ</Typography>
            {error && (
              <Alert severity="error" aria-live="assertive">
                {error}
              </Alert>
            )}
            <TextField
              inputRef={passwordInputRef}
              label="รหัสผ่านปัจจุบัน"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={submitting}
              required
              fullWidth
            />
            {snapshot.assurance === "mfa" && (
              <>
                <FormControl>
                  <FormLabel>วิธียืนยันเพิ่มเติม</FormLabel>
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
                  onChange={(event) => setFactorValue(event.target.value)}
                  autoComplete="one-time-code"
                  slotProps={{
                    htmlInput: { inputMode: factorType === "totp" ? "numeric" : "text" }
                  }}
                  disabled={submitting}
                  required
                  fullWidth
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "กำลังตรวจสอบ" : "ยืนยัน"}
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
}
