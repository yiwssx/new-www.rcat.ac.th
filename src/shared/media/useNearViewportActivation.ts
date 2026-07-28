import { useEffect, useRef, useState } from "react";
import { observeNearViewport } from "./nearViewport";

export function useNearViewportActivation(enabled: boolean, rootMargin: string) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (!enabled || activated) {
      return undefined;
    }

    const root = rootRef.current;

    if (!root) {
      return undefined;
    }

    return observeNearViewport(root, () => setActivated(true), rootMargin);
  }, [activated, enabled, rootMargin]);

  return {
    activated,
    rootRef
  };
}
