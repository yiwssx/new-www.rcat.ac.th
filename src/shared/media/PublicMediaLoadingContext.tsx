import type { ReactNode } from "react";
import { PublicMediaLoadingContext } from "./publicMediaLoadingState";

export function PublicMediaLoadingProvider({
  children,
  pageMediaAllowed
}: {
  children: ReactNode;
  pageMediaAllowed: boolean;
}) {
  return (
    <PublicMediaLoadingContext.Provider value={{ pageMediaAllowed }}>{children}</PublicMediaLoadingContext.Provider>
  );
}
