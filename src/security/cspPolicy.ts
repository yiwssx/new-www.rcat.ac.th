export const CSP_REPORT_PATH = "/api/csp-report";

const SCRIPT_SOURCES = ["'self'", "https://www.googletagmanager.com", "https://connect.facebook.net"];
const CONNECT_SOURCES = [
  "'self'",
  "https://*.workers.dev",
  "https://*.rcat.ac.th",
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://www.googletagmanager.com"
];
const FRAME_SOURCES = [
  "https://www.facebook.com",
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://www.google.com",
  "https://docs.google.com",
  "https://drive.google.com"
];

export interface BuildContentSecurityPolicyOptions {
  scriptNonce?: string;
  allowInlineScripts?: boolean;
}

export function buildContentSecurityPolicy({
  scriptNonce,
  allowInlineScripts = false
}: BuildContentSecurityPolicyOptions = {}) {
  const scripts = [...SCRIPT_SOURCES];
  if (scriptNonce) {
    scripts.splice(1, 0, `'nonce-${scriptNonce}'`);
  } else if (allowInlineScripts) {
    scripts.splice(1, 0, "'unsafe-inline'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${CONNECT_SOURCES.join(" ")}`,
    `frame-src ${FRAME_SOURCES.join(" ")}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `report-uri ${CSP_REPORT_PATH}`
  ].join("; ");
}
