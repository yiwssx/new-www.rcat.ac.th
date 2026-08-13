export type PublicApiProviderEnv = Record<string, unknown>;

function readEnvString(env: PublicApiProviderEnv, key: string) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function getRuntimePublicApiEnv(): PublicApiProviderEnv {
  const metaEnv = ((import.meta as ImportMeta & { env?: PublicApiProviderEnv }).env || {}) as PublicApiProviderEnv;
  const processEnv = typeof process !== "undefined" ? process.env : {};

  return {
    ...processEnv,
    ...metaEnv
  };
}

function readCloudflareBaseUrl(env: PublicApiProviderEnv) {
  return (
    readEnvString(env, "VITE_CLOUDFLARE_PUBLIC_API_URL") || readEnvString(env, "CLOUDFLARE_PUBLIC_API_URL")
  ).replace(/\/+$/, "");
}

export function resolveCloudflarePublicApiBaseUrl(env: PublicApiProviderEnv = getRuntimePublicApiEnv()) {
  const baseUrl = readCloudflareBaseUrl(env);

  if (!baseUrl) {
    throw new Error("VITE_CLOUDFLARE_PUBLIC_API_URL or CLOUDFLARE_PUBLIC_API_URL is required for Public API requests");
  }

  return baseUrl;
}

export function getCloudflarePublicApiBaseUrl() {
  return resolveCloudflarePublicApiBaseUrl();
}

export function buildCloudflarePublicApiUrl(path: string, env: PublicApiProviderEnv = getRuntimePublicApiEnv()) {
  const baseUrl = resolveCloudflarePublicApiBaseUrl(env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
