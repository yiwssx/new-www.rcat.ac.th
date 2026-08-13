/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_CMS_SITE_NAME?: string;
  readonly VITE_CLOUDFLARE_PUBLIC_API_URL?: string;
  /** `both` is a deprecated compatibility alias for the default `gtm` transport. */
  readonly VITE_PUBLIC_ANALYTICS_STRATEGY?: "gtm" | "gtag" | "both";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
