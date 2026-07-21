const SESSION_COOKIE_NAME = "__Host-rcat_cms_session";
const CSRF_COOKIE_NAME = "__Host-rcat_cms_csrf";
const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function readExactCookie(cookieHeader, name) {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
    return "";
  }

  const matches = [];

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const cookieName = part.slice(0, separatorIndex).trim();

    if (cookieName === name) {
      matches.push(part.slice(separatorIndex + 1).trim());
    }
  }

  if (matches.length !== 1 || !isValidCmsCookieToken(matches[0])) {
    return "";
  }

  return matches[0];
}

export function isValidCmsCookieToken(value) {
  return typeof value === "string" && value.length === 43 && TOKEN_PATTERN.test(value);
}

export function getCmsSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getCmsCsrfCookieName() {
  return CSRF_COOKIE_NAME;
}

export function hasCmsSessionCookie(cookieHeader) {
  if (typeof cookieHeader !== "string") {
    return false;
  }

  return cookieHeader.split(";").some((part) => {
    const separatorIndex = part.indexOf("=");
    return separatorIndex >= 0 && part.slice(0, separatorIndex).trim() === SESSION_COOKIE_NAME;
  });
}

export function readCmsSessionCookie(cookieHeader) {
  return readExactCookie(cookieHeader, SESSION_COOKIE_NAME);
}

export function readCmsCsrfCookie(cookieHeader) {
  return readExactCookie(cookieHeader, CSRF_COOKIE_NAME);
}

export function createCmsAuthCookies(sessionToken, csrfToken) {
  if (!isValidCmsCookieToken(sessionToken) || !isValidCmsCookieToken(csrfToken)) {
    throw new TypeError("invalid CMS cookie token");
  }

  return [
    `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    `${CSRF_COOKIE_NAME}=${csrfToken}; Path=/; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SECONDS}`
  ];
}

export function clearCmsAuthCookies() {
  return [
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${CSRF_COOKIE_NAME}=; Path=/; Secure; SameSite=Strict; Max-Age=0`
  ];
}
