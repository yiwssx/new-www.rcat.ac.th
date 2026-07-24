import { describe, expect, it } from "vitest";
import { CMS_CSRF_COOKIE_NAME } from "./constants";
import { readCmsCsrfToken, readExactCookie } from "./cookie";

const token = "A".repeat(43);

describe("CMS CSRF cookie parsing", () => {
  it("accepts exactly one exact 43-character base64url cookie", () => {
    expect(readCmsCsrfToken(`other=value; ${CMS_CSRF_COOKIE_NAME}=${token}`)).toBe(token);
  });

  it.each([
    ["missing", "other=value"],
    ["malformed", `${CMS_CSRF_COOKIE_NAME}=short`],
    ["duplicate", `${CMS_CSRF_COOKIE_NAME}=${token}; ${CMS_CSRF_COOKIE_NAME}=${"B".repeat(43)}`],
    ["similarly named", `${CMS_CSRF_COOKIE_NAME}-backup=${token}`],
    ["encoded", `${CMS_CSRF_COOKIE_NAME}=${encodeURIComponent(`${token}=`)}`]
  ])("fails closed for a %s cookie", (_label, cookieHeader) => {
    expect(readCmsCsrfToken(cookieHeader)).toBe("");
  });

  it("does not read Session or MFA Challenge cookies", () => {
    const cookieHeader = `__Host-rcat_cms_session=${token}; __Host-rcat_cms_mfa_challenge=${token}`;
    expect(readCmsCsrfToken(cookieHeader)).toBe("");
    expect(readExactCookie(cookieHeader, CMS_CSRF_COOKIE_NAME)).toBe("");
  });
});
