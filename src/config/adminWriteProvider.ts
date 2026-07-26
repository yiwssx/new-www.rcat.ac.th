export type AdminWriteProvider = "cloudflare";
export type CloudflareAdminAuthMode = "server-proxy";

const serverProxyPath = "/api/admin-proxy";

export function resolveAdminWriteProvider(): AdminWriteProvider {
  return "cloudflare";
}

export function getAdminWriteProvider(): AdminWriteProvider {
  return resolveAdminWriteProvider();
}

export function resolveCloudflareAdminWriteConfig() {
  return {
    baseUrl: serverProxyPath,
    authMode: "server-proxy" as const
  };
}

export function buildCloudflareAdminApiUrl(path: string) {
  const { baseUrl } = resolveCloudflareAdminWriteConfig();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedPath.startsWith("/api/admin/")) {
    throw new Error("Cloudflare admin server proxy only accepts /api/admin/ paths");
  }

  return `${baseUrl}?path=${encodeURIComponent(normalizedPath)}`;
}
