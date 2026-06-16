import { validateM16CloudflarePreviewOrigin } from "./backendProviderPolicy";
import type { PublicApiProviderEnv } from "./publicApiProvider";

export type AdminWriteProvider = "apps-script" | "cloudflare";
export type CloudflareAdminAuthMode = "cloudflare-access";

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

  return mode === "cloudflare-first-preview" &&
    provider === "cloudflare" &&
    authMode === "cloudflare-access" &&
    validation.allowed
    ? "cloudflare"
    : "apps-script";
}

export function getAdminWriteProvider(): AdminWriteProvider {
  return resolveAdminWriteProvider();
}

export function resolveCloudflareAdminWriteConfig(env: PublicApiProviderEnv = import.meta.env) {
  const baseUrl = (
    readEnvString(env, "VITE_CLOUDFLARE_ADMIN_API_URL") || readEnvString(env, "VITE_CLOUDFLARE_PUBLIC_API_URL")
  ).replace(/\/+$/, "");
  const authMode = readEnvString(env, "VITE_CLOUDFLARE_ADMIN_AUTH_MODE").toLowerCase();
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
  const { baseUrl } = resolveCloudflareAdminWriteConfig(env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
