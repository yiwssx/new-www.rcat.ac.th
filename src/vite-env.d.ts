/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_APPS_SCRIPT_URL?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_CMS_SITE_NAME?: string;
  readonly VITE_PUBLIC_ANALYTICS_STRATEGY?: "gtm" | "gtag" | "both";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
