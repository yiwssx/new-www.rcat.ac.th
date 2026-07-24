import { createContext, useContext } from "react";
import type { CmsAuthStatus, CmsCapability, CmsLoginResult, CmsMfaProof, CmsSession } from "../features/cms-auth";

export interface AuthContextValue {
  status: CmsAuthStatus;
  session: CmsSession | null;
  capabilities: readonly CmsCapability[];
  refreshSession: () => Promise<CmsSession | null>;
  login: (identifier: string, password: string) => Promise<CmsLoginResult>;
  verifyMfa: (proof: CmsMfaProof) => Promise<CmsSession>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  reauthenticate: (input: { currentPassword: string } & Partial<CmsMfaProof>) => Promise<void>;
  hasCapability: (capability: CmsCapability) => boolean;
  clearSession: (options?: { broadcast?: boolean }) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
