export const CMS_AUTH_PATHS = Object.freeze({
  login: "/api/cms-auth/login",
  session: "/api/cms-auth/session",
  logout: "/api/cms-auth/logout",
  logoutAll: "/api/cms-auth/logout-all",
  changePassword: "/api/cms-auth/change-password",
  verifyMfa: "/api/cms-auth/mfa/verify",
  startMfaSetup: "/api/cms-auth/mfa/setup/start",
  confirmMfaSetup: "/api/cms-auth/mfa/setup/confirm",
  regenerateRecoveryCodes: "/api/cms-auth/mfa/recovery-codes/regenerate",
  disableMfa: "/api/cms-auth/mfa",
  reauthenticate: "/api/cms-auth/reauthenticate",
  inspectInvitation: "/api/cms-auth/invitation/inspect",
  acceptInvitation: "/api/cms-auth/invitation/accept",
  inspectPasswordReset: "/api/cms-auth/password-reset/inspect",
  completePasswordReset: "/api/cms-auth/password-reset/complete"
} as const);

export const CMS_CSRF_COOKIE_NAME = "__Host-rcat_cms_csrf";
export const CMS_CSRF_HEADER_NAME = "X-RCAT-CSRF-Token";
export const CMS_AUTH_CHANNEL_NAME = "rcat-cms-auth";
export const CMS_SESSION_NOTICE_KEY = "rcat.cms.session.notice";
export const CMS_SESSION_EXPIRED_EVENT = "rcat:cms-session-expired";
export const CMS_SESSION_EXPIRED_MESSAGE = "เซสชัน CMS หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
