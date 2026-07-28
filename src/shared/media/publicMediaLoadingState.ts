import { createContext, useContext } from "react";

export interface PublicMediaLoadingState {
  pageMediaAllowed: boolean;
}

export const PublicMediaLoadingContext = createContext<PublicMediaLoadingState>({
  pageMediaAllowed: true
});

export function usePublicMediaLoading() {
  return useContext(PublicMediaLoadingContext);
}
