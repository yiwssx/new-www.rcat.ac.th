import { validateM16CloudflarePreviewOrigin } from "./backendProviderPolicy";
import type { PublicApiProviderEnv } from "./publicApiProvider";

export type AdminWriteProvider = "apps-script" | "cloudflare";
export type CloudflareAdminAuthMode = "cloudflare-access" | "server-proxy";

const serverProxyPath = "/api/admin-proxy";

function readEnvString(env: PublicApiProviderEnv, key: string) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

export function resolveAdminWriteProvider(env: PublicApiProviderEnv = import.meta.env): AdminWriteProvider {
  const mode = readEnvString(env, "VITE_BACKEND_MIGRATION_MODE");
  const provider = readEnvString(env, "VITE_ADMIN_WRITE_PROVIDER").toLowerCase();
  const authMode = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_AUTH_MODE").toLowerCase();
  const baseUrl =
    readEnvString(env, "VITE_CLOUDFLARE_ADMIN_API_URL") || readEnvString(env, "VITE_CLOUDFLARE_PUBLIC_API_URL");
  const validation = validateM16CloudflarePreviewOrigin(baseUrl);
  const proxyUrl = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_PROXY_URL").replace(/\/+$/, "");
  const validAuthTarget =
    (authMode === "cloudflare-access" && validation.allowed) ||
    (authMode === "server-proxy" && proxyUrl === serverProxyPath);

  return mode === "cloudflare-first-preview" && provider === "cloudflare" && validAuthTarget
    ? "cloudflare"
    : "apps-script";
}

export function getAdminWriteProvider(): AdminWriteProvider {
  return resolveAdminWriteProvider();
}

export function resolveCloudflareAdminWriteConfig(env: PublicApiProviderEnv = import.meta.env) {
  const authMode = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_AUTH_MODE").toLowerCase();

  if (authMode === "server-proxy") {
    const proxyUrl = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_PROXY_URL").replace(/\/+$/, "");

    if (proxyUrl !== serverProxyPath) {
      throw new Error(
        "VITE_CLOUDFLARE_ADMIN_PROXY_URL=/api/admin-proxy is required as a same-origin path for server-proxy mode"
      );
    }

    return {
      baseUrl: proxyUrl,
      authMode: authMode as CloudflareAdminAuthMode
    };
  }

  const baseUrl = (
    readEnvString(env, "VITE_CLOUDFLARE_ADMIN_API_URL") || readEnvString(env, "VITE_CLOUDFLARE_PUBLIC_API_URL")
  ).replace(/\/+$/, "");
  const validation = validateM16CloudflarePreviewOrigin(baseUrl);

  if (!baseUrl || !validation.allowed) {
    throw new Error("A dev or preview Cloudflare admin API URL is required for Cloudflare admin structured writes");
  }

  if (authMode !== "cloudflare-access") {
    throw new Error(
      "VITE_CLOUDFLARE_ADMIN_AUTH_MODE=cloudflare-access is required for Cloudflare admin structured writes"
    );
  }

  return {
    baseUrl,
    authMode: authMode as CloudflareAdminAuthMode
  };
}

export function buildCloudflareAdminApiUrl(path: string, env: PublicApiProviderEnv = import.meta.env) {
  const { authMode, baseUrl } = resolveCloudflareAdminWriteConfig(env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (authMode === "server-proxy") {
    if (!normalizedPath.startsWith("/api/admin/")) {
      throw new Error("Cloudflare admin server proxy only accepts /api/admin/ paths");
    }

    return `${baseUrl}?path=${encodeURIComponent(normalizedPath)}`;
  }

  return `${baseUrl}${normalizedPath}`;
}
