import { useBlocker } from "@tanstack/react-router";
import { useRecoveryCodeHandoff } from "../../context/RecoveryCodeHandoffContext";
import RecoveryCodeHandoffDialog from "./RecoveryCodeHandoffDialog";

export default function RecoveryCodeNavigationGuard() {
  const { shouldBlockNavigation } = useRecoveryCodeHandoff();

  useBlocker({
    shouldBlockFn: shouldBlockNavigation,
    enableBeforeUnload: false
  });

  return <RecoveryCodeHandoffDialog />;
}
