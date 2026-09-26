import registryConfig from "../../../config/public-routes.json";

interface PublicRouteRegistryConfig {
  systemReservedRootSlugs: string[];
  routes: Array<{ path: string }>;
}

const config = registryConfig as PublicRouteRegistryConfig;

function normalizeRootSlug(value: string) {
  return (
    String(value || "")
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .split("/")[0]
      ?.toLocaleLowerCase("en-US") ?? ""
  );
}

const reservedRootSlugs = new Set([
  ...config.systemReservedRootSlugs.map(normalizeRootSlug),
  ...config.routes.map((route) => normalizeRootSlug(route.path)).filter(Boolean)
]);

export const RESERVED_PUBLIC_ROOT_SLUGS = Object.freeze([...reservedRootSlugs].sort());

export function isReservedPublicContentSlug(slug: string) {
  const normalized = normalizeRootSlug(slug);
  return Boolean(normalized && reservedRootSlugs.has(normalized));
}
