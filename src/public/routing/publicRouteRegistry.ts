import registryConfig from "../../../config/public-routes.json";

export type PublicRouteKind = "core" | "application";

export interface PublicRouteMetadata {
  id: string;
  path: string;
  label: string;
  kind: PublicRouteKind;
  menuSelectable: boolean;
  indexable: boolean;
  sitemap: boolean;
  title?: string;
  description: string;
  robots?: string;
}

interface PublicRouteRegistryConfig {
  version: number;
  systemReservedRootSlugs: string[];
  routes: PublicRouteMetadata[];
}

const config = registryConfig as PublicRouteRegistryConfig;

function normalizeRoutePath(path: string) {
  if (path === "/") {
    return path;
  }

  const trimmed = path.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/{2,}/g, "/").replace(/\/+$/g, "");
}

function normalizeRootSlug(value: string) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0]
    ?.toLocaleLowerCase("en-US") ?? "";
}

export function validatePublicRouteRegistry(input: PublicRouteRegistryConfig = config) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  if (input.version !== 1) {
    errors.push(`unsupported public route registry version: ${input.version}`);
  }

  input.routes.forEach((route) => {
    const normalizedPath = normalizeRoutePath(route.path);

    if (!route.id.trim()) {
      errors.push("route id must not be empty");
    } else if (ids.has(route.id)) {
      errors.push(`duplicate route id: ${route.id}`);
    } else {
      ids.add(route.id);
    }

    if (!route.path.startsWith("/") || route.path !== normalizedPath) {
      errors.push(`route path is not canonical: ${route.path}`);
    } else if (paths.has(route.path)) {
      errors.push(`duplicate route path: ${route.path}`);
    } else {
      paths.add(route.path);
    }

    if (!route.label.trim()) {
      errors.push(`route label must not be empty: ${route.id}`);
    }

    if (!route.description.trim()) {
      errors.push(`route description must not be empty: ${route.id}`);
    }

    if (route.sitemap && !route.indexable) {
      errors.push(`sitemap route must be indexable: ${route.id}`);
    }

    if (route.menuSelectable && !route.label.trim()) {
      errors.push(`menu-selectable route must have a label: ${route.id}`);
    }
  });

  const reserved = new Set<string>();
  input.systemReservedRootSlugs.forEach((slug) => {
    const normalized = normalizeRootSlug(slug);
    if (!normalized) {
      errors.push("system reserved root slug must not be empty");
    } else if (reserved.has(normalized)) {
      errors.push(`duplicate system reserved root slug: ${normalized}`);
    } else {
      reserved.add(normalized);
    }
  });

  return errors;
}

const registryErrors = validatePublicRouteRegistry();
if (registryErrors.length) {
  throw new Error(`Invalid public route registry: ${registryErrors.join("; ")}`);
}

export const PUBLIC_ROUTE_REGISTRY: readonly PublicRouteMetadata[] = Object.freeze(
  config.routes.map((route) => Object.freeze({ ...route }))
);

export const PUBLIC_ROUTE_REGISTRY_VERSION = config.version;

export const PUBLIC_MENU_ROUTE_OPTIONS = Object.freeze(
  PUBLIC_ROUTE_REGISTRY.filter((route) => route.menuSelectable).map(({ id, path, label, kind }) => ({
    id,
    path,
    label,
    kind
  }))
);

export const PUBLIC_INDEXABLE_SITEMAP_ROUTES = Object.freeze(
  PUBLIC_ROUTE_REGISTRY.filter((route) => route.indexable && route.sitemap).map((route) => route.path)
);

const publicRouteByPath = new Map(PUBLIC_ROUTE_REGISTRY.map((route) => [route.path, route]));

export function getPublicRouteMetadata(pathname: string) {
  return publicRouteByPath.get(normalizeRoutePath(pathname));
}

const reservedRootSlugs = new Set([
  ...config.systemReservedRootSlugs.map(normalizeRootSlug),
  ...PUBLIC_ROUTE_REGISTRY.map((route) => normalizeRootSlug(route.path)).filter(Boolean)
]);

export const PUBLIC_RESERVED_ROOT_SLUGS = Object.freeze([...reservedRootSlugs].sort());

export function isReservedPublicRootSlug(slug: string) {
  const normalized = normalizeRootSlug(slug);
  return Boolean(normalized && reservedRootSlugs.has(normalized));
}
