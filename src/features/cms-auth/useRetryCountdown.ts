import { useEffect, useState } from "react";

export function useRetryCountdown() {
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfterSeconds]);

  return {
    retryAfterSeconds,
    startRetryCountdown: (seconds: number | undefined) =>
      setRetryAfterSeconds(Number.isInteger(seconds) && Number(seconds) > 0 ? Number(seconds) : 0)
  };
}
