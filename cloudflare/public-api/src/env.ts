export interface Env {
  PUBLIC_API_ALLOWED_ORIGINS?: string;
  PUBLIC_API_VERSION?: string;
  ADMIN_WRITE_ALLOWED_ORIGINS?: string;
  CMS_AUTH_PROXY_SECRET?: string;
  CMS_MFA_ENCRYPTION_KEY?: string;
  CMS_MFA_ENCRYPTION_KEY_VERSION?: string;
  ENVIRONMENT?: string;
  ENV?: string;
  CF_PAGES_BRANCH?: string;
  DB?: D1Database;
}
