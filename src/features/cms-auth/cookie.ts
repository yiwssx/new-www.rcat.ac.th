import { CMS_CSRF_COOKIE_NAME } from "./constants";

const CMS_CSRF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readExactCookie(cookieHeader: string, cookieName: string) {
  const matches: string[] = [];

  for (const segment of cookieHeader.split(";")) {
    const part = segment.trim();
    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 0 || part.slice(0, separatorIndex) !== cookieName) {
      continue;
    }

    matches.push(part.slice(separatorIndex + 1));
  }

  return matches.length === 1 ? matches[0] : "";
}

export function readCmsCsrfToken(cookieHeader = typeof document === "undefined" ? "" : document.cookie) {
  const token = readExactCookie(cookieHeader, CMS_CSRF_COOKIE_NAME);
  return CMS_CSRF_TOKEN_PATTERN.test(token) ? token : "";
}

export function isValidCmsCsrfToken(value: unknown): value is string {
  return typeof value === "string" && CMS_CSRF_TOKEN_PATTERN.test(value);
}
