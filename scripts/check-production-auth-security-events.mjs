import { appendFile } from "node:fs/promises";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const LOOKBACK_MINUTES = Math.max(15, Number(process.env.AUTH_SECURITY_LOOKBACK_MINUTES || 135));
const WARNING_EVENTS = Math.max(1, Number(process.env.AUTH_SECURITY_WARNING_EVENTS || 10));
const CRITICAL_EVENTS = Math.max(WARNING_EVENTS + 1, Number(process.env.AUTH_SECURITY_CRITICAL_EVENTS || 30));
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const token = String(process.env.CLOUDFLARE_ANALYTICS_READ_TOKEN || "").trim();

if (!accountId || !token) {
  console.error("Auth security events: read-only Cloudflare analytics credentials are unavailable.");
  process.exit(1);
}

const end = new Date();
const start = new Date(end.getTime() - LOOKBACK_MINUTES * 60_000);
const query = `query P6BAuthSecurity($accountTag: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      zones {
        firewallEventsAdaptive(
          filter: { datetime_geq: $start, datetime_leq: $end }
          limit: 1000
          orderBy: [datetime_DESC]
        ) {
          action
          clientRequestPath
          datetime
          source
        }
      }
    }
  }
}`;

const response = await fetch(GRAPHQL_ENDPOINT, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    query,
    variables: {
      accountTag: accountId,
      start: start.toISOString(),
      end: end.toISOString()
    }
  })
});

const payload = await response.json().catch(() => null);
if (!response.ok || payload?.errors?.length) {
  console.error("Auth security events: Cloudflare firewall analytics query failed.");
  process.exit(1);
}

const accounts = payload?.data?.viewer?.accounts || [];
const events = accounts.flatMap((account) =>
  (account.zones || []).flatMap((zone) => zone.firewallEventsAdaptive || [])
);
const sensitive = events.filter((event) => {
  const path = String(event.clientRequestPath || "");
  const action = String(event.action || "").toLowerCase();
  return (path.startsWith("/api/cms-auth/") || path === "/api/admin-proxy") && action !== "allow" && action !== "skip";
});

const count = sensitive.length;
const severity =
  count >= CRITICAL_EVENTS ? "critical" : count >= WARNING_EVENTS ? "warning" : count > 0 ? "info" : "healthy";

console.log(
  `Auth security events: ${severity}; ${count} sensitive edge security event(s) in the last ${LOOKBACK_MINUTES} minutes.`
);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `severity=${severity}\nevent_count=${count}\n`);
}
