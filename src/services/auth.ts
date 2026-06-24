import { getAdminWriteProvider } from "../config/adminWriteProvider";
import type { Session } from "../types";
import { isAdminProxySessionEnabled, loginCloudflareAdminProxySession } from "./adminProxySession";

export { isTokenExpired, restoreSession } from "./authSession";

export async function login(email: string, password: string): Promise<Session> {
  if (isAdminProxySessionEnabled()) {
    return loginCloudflareAdminProxySession(email, password);
  }

  if (getAdminWriteProvider() === "apps-script") {
    throw new Error(
      "Legacy Apps Script credential login has been removed. Configure the Cloudflare admin proxy session."
    );
  }

  throw new Error("Credential login is unavailable for the configured Cloudflare admin authentication mode");
}
