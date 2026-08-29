const API_BASE = "https://api.cloudflare.com/client/v4";
const ZONE_NAME = "rcat.ac.th";
const MODE = process.argv.includes("--apply") ? "apply" : "check";
const CUSTOM_DESCRIPTION = "RCAT P6B: block direct internal API paths";
const RATE_DESCRIPTION = "RCAT P6B: sensitive admin and auth API burst guard";

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();

if (!accountId || !apiToken) {
  console.error("P6B Cloudflare security: protected production credentials are unavailable.");
  process.exit(1);
}

async function cf(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const code = payload?.errors?.[0]?.code;
    const message = payload?.errors?.[0]?.message;
    const safe = [code ? `code ${code}` : "", message || "Cloudflare API request failed"].filter(Boolean).join(": ");
    const error = new Error(safe);
    error.status = response.status;
    throw error;
  }

  return payload?.result;
}

async function resolveZone() {
  const params = new URLSearchParams({
    name: ZONE_NAME,
    status: "active",
    per_page: "50",
    "account.id": accountId
  });
  const zones = await cf(`/zones?${params}`);
  if (!Array.isArray(zones) || zones.length !== 1) {
    throw new Error("expected exactly one active Cloudflare zone for the production hostname");
  }
  return zones[0].id;
}

async function entrypoint(zoneId, phase) {
  try {
    return await cf(`/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function sameRule(actual, desired) {
  if (!actual) return false;
  if (
    actual.description !== desired.description ||
    actual.action !== desired.action ||
    actual.expression !== desired.expression ||
    actual.enabled === false
  ) {
    return false;
  }

  if (!desired.ratelimit) return true;
  const rate = actual.ratelimit || {};
  return (
    rate.period === desired.ratelimit.period &&
    rate.requests_per_period === desired.ratelimit.requests_per_period &&
    rate.mitigation_timeout === desired.ratelimit.mitigation_timeout &&
    JSON.stringify(rate.characteristics || []) === JSON.stringify(desired.ratelimit.characteristics)
  );
}

async function reconcilePhase(zoneId, phase, desiredRule) {
  let ruleset = await entrypoint(zoneId, phase);

  if (!ruleset) {
    if (MODE !== "apply") throw new Error(`${phase} entry point is missing`);
    ruleset = await cf(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: JSON.stringify({
        name: "zone",
        description: "RCAT zone security entry point",
        kind: "zone",
        phase,
        rules: [desiredRule]
      })
    });
    console.log(`P6B Cloudflare security: created ${phase} entry point with managed rule.`);
    return;
  }

  const actual = (ruleset.rules || []).find((rule) => rule.description === desiredRule.description);
  if (sameRule(actual, desiredRule)) {
    console.log(`P6B Cloudflare security: ${desiredRule.description} is current.`);
    return;
  }

  if (MODE !== "apply") throw new Error(`${desiredRule.description} is missing or drifted`);

  if (actual?.id) {
    await cf(`/zones/${zoneId}/rulesets/${ruleset.id}/rules/${actual.id}`, {
      method: "PUT",
      body: JSON.stringify(desiredRule)
    });
    console.log(`P6B Cloudflare security: updated ${desiredRule.description}.`);
  } else {
    await cf(`/zones/${zoneId}/rulesets/${ruleset.id}/rules`, {
      method: "POST",
      body: JSON.stringify(desiredRule)
    });
    console.log(`P6B Cloudflare security: added ${desiredRule.description}.`);
  }
}

try {
  const zoneId = await resolveZone();

  await reconcilePhase(zoneId, "http_request_firewall_custom", {
    description: CUSTOM_DESCRIPTION,
    expression:
      '(http.host eq "www.rcat.ac.th" and (starts_with(http.request.uri.path, "/api/internal/") or starts_with(http.request.uri.path, "/api/admin/")))',
    action: "block",
    enabled: true
  });

  await reconcilePhase(zoneId, "http_ratelimit", {
    description: RATE_DESCRIPTION,
    expression: '(starts_with(http.request.uri.path, "/api/cms-auth/") or http.request.uri.path eq "/api/admin-proxy")',
    action: "block",
    enabled: true,
    ratelimit: {
      characteristics: ["cf.colo.id", "ip.src"],
      period: 10,
      requests_per_period: 30,
      mitigation_timeout: 10
    }
  });

  console.log(`P6B Cloudflare security: ${MODE} completed without protected identifiers in output.`);
} catch (error) {
  console.error(`P6B Cloudflare security: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
