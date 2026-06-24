export function isProductionBuild() {
  return Boolean(import.meta.env.PROD) || import.meta.env.MODE === "production";
}

export function assertLocalAuthFallbackAllowed() {
  if (isProductionBuild()) {
    throw new Error(
      "Local credential fallback is disabled in production. Configure the Cloudflare admin proxy session."
    );
  }
}
