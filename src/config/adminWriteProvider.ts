import type { PublicApiProviderEnv } from "./publicApiProvider";

export type AdminWriteProvider = "apps-script" | "cloudflare";
export type CloudflareAdminAuthMode = "server-proxy";

const serverProxyPath = "/api/admin-proxy";

function readEnvString(env: PublicApiProviderEnv, key: string) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

export function resolveAdminWriteProvider(env: PublicApiProviderEnv = import.meta.env): AdminWriteProvider {
  const mode = readEnvString(env, "VITE_BACKEND_MIGRATION_MODE");
  const provider = readEnvString(env, "VITE_ADMIN_WRITE_PROVIDER").toLowerCase();
  const proxyUrl = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_PROXY_URL").replace(/\/+$/, "");

  return mode === "cloudflare-first-preview" && provider === "cloudflare" && proxyUrl === serverProxyPath
    ? "cloudflare"
    : "apps-script";
}

export function getAdminWriteProvider(): AdminWriteProvider {
  return resolveAdminWriteProvider();
}

export function resolveCloudflareAdminWriteConfig(env: PublicApiProviderEnv = import.meta.env) {
  const proxyUrl = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_PROXY_URL").replace(/\/+$/, "");

  if (proxyUrl !== serverProxyPath) {
    throw new Error("VITE_CLOUDFLARE_ADMIN_PROXY_URL=/api/admin-proxy is required as the same-origin CMS Admin proxy");
  }

  return {
    baseUrl: proxyUrl,
    authMode: "server-proxy" as const
  };
}

export function buildCloudflareAdminApiUrl(path: string, env: PublicApiProviderEnv = import.meta.env) {
  const { baseUrl } = resolveCloudflareAdminWriteConfig(env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedPath.startsWith("/api/admin/")) {
    throw new Error("Cloudflare admin server proxy only accepts /api/admin/ paths");
  }

  return `${baseUrl}?path=${encodeURIComponent(normalizedPath)}`;
}
