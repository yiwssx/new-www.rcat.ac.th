import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  RecoveryCodeHandoffContext,
  type RecoveryCodeHandoff,
  type RecoveryCodeHandoffContextValue
} from "./RecoveryCodeHandoffContext";

function validateRecoveryCodes(codes: readonly string[]) {
  if (codes.length !== 10 || codes.some((code) => typeof code !== "string" || code.length === 0)) {
    throw new TypeError("Recovery Code handoff requires exactly ten codes");
  }
}

export function RecoveryCodeHandoffProvider({ children }: { children: ReactNode }) {
  const [handoff, setHandoff] = useState<RecoveryCodeHandoff | null>(null);
  const handoffRef = useRef<RecoveryCodeHandoff | null>(null);

  const beginRecoveryCodeHandoff = useCallback((nextHandoff: RecoveryCodeHandoff) => {
    validateRecoveryCodes(nextHandoff.codes);

    if (handoffRef.current) {
      throw new Error("A Recovery Code handoff is already active");
    }

    const next = {
      mode: nextHandoff.mode,
      codes: [...nextHandoff.codes]
    };
    handoffRef.current = next;
    setHandoff(next);
  }, []);

  const clearRecoveryCodeHandoff = useCallback(() => {
    handoffRef.current = null;
    setHandoff(null);
  }, []);

  const shouldBlockNavigation = useCallback(() => handoffRef.current !== null, []);

  useEffect(() => {
    if (!handoff) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handoff]);

  const value = useMemo<RecoveryCodeHandoffContextValue>(
    () => ({
      handoff,
      beginRecoveryCodeHandoff,
      clearRecoveryCodeHandoff,
      shouldBlockNavigation
    }),
    [beginRecoveryCodeHandoff, clearRecoveryCodeHandoff, handoff, shouldBlockNavigation]
  );

  return <RecoveryCodeHandoffContext.Provider value={value}>{children}</RecoveryCodeHandoffContext.Provider>;
}
