import { createContext, useContext } from "react";

export type RecoveryCodeHandoffMode = "mandatory" | "voluntary" | "regenerated";

export interface RecoveryCodeHandoff {
  codes: readonly string[];
  mode: RecoveryCodeHandoffMode;
}

export interface RecoveryCodeHandoffContextValue {
  handoff: RecoveryCodeHandoff | null;
  beginRecoveryCodeHandoff: (handoff: RecoveryCodeHandoff) => void;
  clearRecoveryCodeHandoff: () => void;
  shouldBlockNavigation: () => boolean;
}

export const RecoveryCodeHandoffContext = createContext<RecoveryCodeHandoffContextValue | undefined>(undefined);

export function useRecoveryCodeHandoff() {
  const context = useContext(RecoveryCodeHandoffContext);

  if (!context) {
    throw new Error("useRecoveryCodeHandoff must be used within RecoveryCodeHandoffProvider.");
  }

  return context;
}
