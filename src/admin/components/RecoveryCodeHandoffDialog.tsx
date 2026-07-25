import { useState } from "react";
import { Alert, Dialog, DialogContent, DialogTitle, Stack } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../context/authSessionContext";
import { useRecoveryCodeHandoff } from "../../context/RecoveryCodeHandoffContext";
import { broadcastCmsSessionEvent, CmsAuthError, getCmsAuthErrorMessage } from "../../features/cms-auth";
import RecoveryCodesPanel from "./RecoveryCodesPanel";

export default function RecoveryCodeHandoffDialog() {
  const navigate = useNavigate();
  const { clearSession, refreshSession } = useAuth();
  const { clearRecoveryCodeHandoff, handoff } = useRecoveryCodeHandoff();
  const [error, setError] = useState<{ handoff: typeof handoff; message: string } | null>(null);

  async function acknowledge() {
    if (!handoff) {
      return;
    }

    setError(null);

    try {
      if (handoff.mode === "mandatory") {
        const nextSession = await refreshSession();

        if (!nextSession) {
          throw new CmsAuthError(401);
        }

        broadcastCmsSessionEvent("session-changed");
        clearRecoveryCodeHandoff();
        await navigate({ to: "/admin", replace: true });
        return;
      }

      if (handoff.mode === "voluntary") {
        clearSession({ broadcast: true });
        clearRecoveryCodeHandoff();
        await navigate({ to: "/login", replace: true });
        return;
      }

      clearRecoveryCodeHandoff();
    } catch (currentError) {
      setError({
        handoff,
        message: getCmsAuthErrorMessage(currentError, "ไม่สามารถดำเนินการต่อได้ กรุณาลองอีกครั้ง")
      });
    }
  }

  return (
    <Dialog
      open={handoff !== null}
      disableEscapeKeyDown
      onClose={() => undefined}
      fullWidth
      maxWidth="md"
      aria-labelledby="recovery-code-handoff-title"
    >
      <DialogTitle id="recovery-code-handoff-title">บันทึกรหัสกู้คืนก่อนดำเนินการต่อ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error?.handoff === handoff && (
            <Alert severity="error" aria-live="assertive">
              {error.message}
            </Alert>
          )}
          {handoff && (
            <RecoveryCodesPanel
              key={`${handoff.mode}:${handoff.codes[0]}`}
              codes={handoff.codes}
              priorCodesInvalid={handoff.mode === "regenerated"}
              onAcknowledge={acknowledge}
            />
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
