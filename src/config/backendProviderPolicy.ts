import { resolvePublicApiProvider, type PublicApiProviderEnv } from "./publicApiProvider";

export type BackendMigrationMode = "legacy-apps-script" | "cloudflare-first-preview";

export type BackendEndpointKey =
  | "public-document-list"
  | "public-home"
  | "content-list"
  | "content-detail"
  | "search"
  | "program"
  | "site-view"
  | "visitor-stats"
  | "admin-structured-data"
  | "media-metadata"
  | "media-file-upload-delete";

export interface CloudflarePreviewOriginValidation {
  allowed: boolean;
  isProductionCutoverTarget: false;
  reason: "dev-preview-origin" | "empty-origin" | "invalid-origin" | "forbidden-origin" | "not-dev-preview-origin";
}

export interface BackendProviderPolicy {
  mode: BackendMigrationMode;
  publicApiProvider: "apps-script" | "cloudflare";
  productionDomainCutoverAllowed: false;
  productionFrontendDomainRequired: false;
  cloudflarePreviewEndpointAllowed: boolean;
  m15ProductionValidationRemainsStrict: true;
  appsScriptFallbackForUnmigratedEndpoints: true;
  mediaOperationsMayUseAppsScript: true;
  validationIssues: string[];
}

export interface BackendEndpointMigrationPolicy {
  endpoint: BackendEndpointKey;
  currentProvider: "apps-script" | "cloudflare-preview-capable";
  targetProvider: "cloudflare-worker-d1" | "apps-script-media-bridge";
  appsScriptFallback: true;
}

const m16MigrationMode = "cloudflare-first-preview";
const devPreviewHostMarkers = ["preview", "dev", "staging", "test", "sandbox", "localhost"];
const localDevHosts = new Set(["127.0.0.1", "::1"]);
const forbiddenHosts = [
  ["rcat", "ac", "th"].join("."),
  ["script", "google", "com"].join("."),
  ["drive", "google", "com"].join(".")
];

const endpointPolicies: Record<BackendEndpointKey, BackendEndpointMigrationPolicy> = {
  "public-document-list": {
    endpoint: "public-document-list",
    currentProvider: "cloudflare-preview-capable",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "public-home": {
    endpoint: "public-home",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "content-list": {
    endpoint: "content-list",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "content-detail": {
    endpoint: "content-detail",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  search: {
    endpoint: "search",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  program: {
    endpoint: "program",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "site-view": {
    endpoint: "site-view",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "visitor-stats": {
    endpoint: "visitor-stats",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "admin-structured-data": {
    endpoint: "admin-structured-data",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "media-metadata": {
    endpoint: "media-metadata",
    currentProvider: "apps-script",
    targetProvider: "cloudflare-worker-d1",
    appsScriptFallback: true
  },
  "media-file-upload-delete": {
    endpoint: "media-file-upload-delete",
    currentProvider: "apps-script",
    targetProvider: "apps-script-media-bridge",
    appsScriptFallback: true
  }
};

function readEnvString(env: PublicApiProviderEnv, key: string) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function resolveBackendMigrationMode(env: PublicApiProviderEnv): BackendMigrationMode {
  return readEnvString(env, "VITE_BACKEND_MIGRATION_MODE") === m16MigrationMode
    ? "cloudflare-first-preview"
    : "legacy-apps-script";
}

export function validateM16CloudflarePreviewOrigin(rawOrigin: string): CloudflarePreviewOriginValidation {
  const trimmedOrigin = rawOrigin.trim();

  if (!trimmedOrigin) {
    return {
      allowed: false,
      isProductionCutoverTarget: false,
      reason: "empty-origin"
    };
  }

  let origin: URL;

  try {
    origin = new URL(trimmedOrigin);
  } catch {
    return {
      allowed: false,
      isProductionCutoverTarget: false,
      reason: "invalid-origin"
    };
  }

  const hostname = origin.hostname.toLowerCase();

  if (forbiddenHosts.some((forbiddenHost) => hostname === forbiddenHost || hostname.endsWith(`.${forbiddenHost}`))) {
    return {
      allowed: false,
      isProductionCutoverTarget: false,
      reason: "forbidden-origin"
    };
  }

  const isLocalDevHost = localDevHosts.has(hostname);
  const hasDevPreviewMarker = devPreviewHostMarkers.some((marker) => hostname.includes(marker));

  if (origin.protocol === "https:" && (hasDevPreviewMarker || isLocalDevHost)) {
    return {
      allowed: true,
      isProductionCutoverTarget: false,
      reason: "dev-preview-origin"
    };
  }

  if (origin.protocol === "http:" && isLocalDevHost) {
    return {
      allowed: true,
      isProductionCutoverTarget: false,
      reason: "dev-preview-origin"
    };
  }

  return {
    allowed: false,
    isProductionCutoverTarget: false,
    reason: "not-dev-preview-origin"
  };
}

export function resolveBackendProviderPolicy(env: PublicApiProviderEnv = import.meta.env): BackendProviderPolicy {
  const mode = resolveBackendMigrationMode(env);
  const publicApiProvider = resolvePublicApiProvider(env);
  const cloudflareOrigin = readEnvString(env, "VITE_CLOUDFLARE_PUBLIC_API_URL");
  const cloudflareOriginValidation = validateM16CloudflarePreviewOrigin(cloudflareOrigin);
  const cloudflarePreviewEndpointAllowed =
    mode === "cloudflare-first-preview" && publicApiProvider === "cloudflare" && cloudflareOriginValidation.allowed;
  const validationIssues: string[] = [];

  if (
    mode === "cloudflare-first-preview" &&
    publicApiProvider === "cloudflare" &&
    !cloudflareOriginValidation.allowed
  ) {
    validationIssues.push(
      `VITE_CLOUDFLARE_PUBLIC_API_URL must be a dev or preview origin for M16 (${cloudflareOriginValidation.reason})`
    );
  }

  return {
    mode,
    publicApiProvider,
    productionDomainCutoverAllowed: false,
    productionFrontendDomainRequired: false,
    cloudflarePreviewEndpointAllowed,
    m15ProductionValidationRemainsStrict: true,
    appsScriptFallbackForUnmigratedEndpoints: true,
    mediaOperationsMayUseAppsScript: true,
    validationIssues
  };
}

export function getBackendEndpointMigrationPolicy(endpoint: BackendEndpointKey): BackendEndpointMigrationPolicy {
  return endpointPolicies[endpoint];
}
