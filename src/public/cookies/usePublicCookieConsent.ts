import { useSyncExternalStore } from "react";
import {
  getPublicCookieConsentSnapshot,
  getServerPublicCookieConsentSnapshot,
  parsePublicCookieConsent,
  savePublicCookieConsent,
  subscribePublicCookieConsent
} from "./publicCookieConsent";

export function usePublicCookieConsent() {
  const snapshot = useSyncExternalStore(
    subscribePublicCookieConsent,
    getPublicCookieConsentSnapshot,
    getServerPublicCookieConsentSnapshot
  );
  const consent = snapshot === undefined ? undefined : parsePublicCookieConsent(snapshot);

  const chooseConsent = (analytics: boolean) => {
    const hadAnalytics = consent?.analytics === true;
    savePublicCookieConsent(analytics);

    if (hadAnalytics && !analytics) {
      // Reload to terminate already-mounted third-party analytics scripts on withdrawal.
      window.location.reload();
    }
  };

  return { consent, chooseConsent };
}
