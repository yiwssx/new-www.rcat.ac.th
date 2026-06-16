/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_APPS_SCRIPT_URL?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_CMS_SITE_NAME?: string;
  readonly VITE_BACKEND_MIGRATION_MODE?: string;
  readonly VITE_PUBLIC_API_PROVIDER?: string;
  readonly VITE_CLOUDFLARE_PUBLIC_API_URL?: string;
  readonly VITE_ADMIN_WRITE_PROVIDER?: string;
  readonly VITE_CLOUDFLARE_ADMIN_API_URL?: string;
  readonly VITE_CLOUDFLARE_ADMIN_AUTH_MODE?: "cloudflare-access";
  readonly VITE_PUBLIC_ANALYTICS_STRATEGY?: "gtm" | "gtag" | "both";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
