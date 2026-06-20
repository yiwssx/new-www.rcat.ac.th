export type PublicApiProvider = "apps-script" | "cloudflare";

export type PublicApiProviderEnv = Record<string, unknown>;

function readEnvString(env: PublicApiProviderEnv, key: string) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

export function resolvePublicApiProvider(env: PublicApiProviderEnv = import.meta.env): PublicApiProvider {
  const provider = readEnvString(env, "VITE_PUBLIC_API_PROVIDER").toLowerCase();

  return provider === "cloudflare" ? "cloudflare" : "apps-script";
}

export function getPublicApiProvider(): PublicApiProvider {
  return resolvePublicApiProvider();
}

export function resolveCloudflarePublicApiBaseUrl(env: PublicApiProviderEnv = import.meta.env) {
  const baseUrl = readEnvString(env, "VITE_CLOUDFLARE_PUBLIC_API_URL").replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error("VITE_CLOUDFLARE_PUBLIC_API_URL is required when VITE_PUBLIC_API_PROVIDER=cloudflare");
  }

  return baseUrl;
}

export function getCloudflarePublicApiBaseUrl() {
  return resolveCloudflarePublicApiBaseUrl();
}

export function buildCloudflarePublicApiUrl(path: string, env: PublicApiProviderEnv = import.meta.env) {
  const baseUrl = resolveCloudflarePublicApiBaseUrl(env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
