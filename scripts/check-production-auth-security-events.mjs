import { appendFile } from "node:fs/promises";

const API_BASE = "https://api.cloudflare.com/client/v4";
const LOOKBACK_MINUTES = Math.max(15, Number(process.env.AUTH_SECURITY_LOOKBACK_MINUTES || 135));
const WARNING_EVENTS = Math.max(1, Number(process.env.AUTH_SECURITY_WARNING_EVENTS || 10));
const CRITICAL_EVENTS = Math.max(WARNING_EVENTS + 1, Number(process.env.AUTH_SECURITY_CRITICAL_EVENTS || 30));
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const databaseId = String(process.env.RCAT_PRODUCTION_D1_DATABASE_ID || "").trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();

if (!accountId || !databaseId || !token) {
  console.error("Auth security events: protected D1 read credentials are unavailable.");
  process.exit(1);
}

const start = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();
const sql = `SELECT
  (SELECT COALESCE(SUM(failed_login_count), 0)
   FROM admin_credentials
   WHERE updated_at >= ?) AS password_failures,
  (SELECT COUNT(*)
   FROM admin_credentials
   WHERE updated_at >= ?
     AND failed_login_count >= 5) AS locked_accounts,
  (SELECT COALESCE(SUM(failed_attempt_count), 0)
   FROM admin_mfa_challenges
   WHERE created_at >= ?) AS mfa_failures`;

const response = await fetch(`${API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ sql, params: [start, start, start] })
});

const payload = await response.json().catch(() => null);
const queryResult = Array.isArray(payload?.result) ? payload.result[0] : null;
const row = queryResult?.results?.[0];

if (!response.ok || payload?.success !== true || queryResult?.success === false || !row) {
  console.error("Auth security events: protected D1 aggregate query failed.");
  process.exit(1);
}

const passwordFailures = Math.max(0, Number(row.password_failures || 0));
const mfaFailures = Math.max(0, Number(row.mfa_failures || 0));
const lockedAccounts = Math.max(0, Number(row.locked_accounts || 0));
const eventCount = passwordFailures + mfaFailures;
const severity =
  eventCount >= CRITICAL_EVENTS || lockedAccounts >= 3
    ? "critical"
    : eventCount >= WARNING_EVENTS || lockedAccounts >= 1
      ? "warning"
      : eventCount > 0
        ? "info"
        : "healthy";

console.log(
  `Auth security events: ${severity}; ${eventCount} failed auth/MFA attempt state(s), ${lockedAccounts} locked account(s), last ${LOOKBACK_MINUTES} minutes.`
);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `severity=${severity}\nevent_count=${eventCount}\nlocked_accounts=${lockedAccounts}\n`
  );
}
