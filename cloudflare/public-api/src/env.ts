export interface Env {
  PUBLIC_API_ALLOWED_ORIGINS?: string;
  PUBLIC_API_VERSION?: string;
  ADMIN_WRITE_ALLOWED_ORIGINS?: string;
  ADMIN_WRITE_PREVIEW_ENABLED?: string;
  ADMIN_WRITE_TOKEN?: string;
  ENVIRONMENT?: string;
  DB?: D1Database;
}
