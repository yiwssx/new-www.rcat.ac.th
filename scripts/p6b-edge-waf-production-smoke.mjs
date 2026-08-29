const ORIGIN = "https://www.rcat.ac.th";
const MARKER = "p6b-vercel-v1";
const MAX_ATTEMPTS = Math.max(1, Number(process.env.P6B_EDGE_WAF_MAX_ATTEMPTS || 24));
const RETRY_MS = Math.max(1000, Number(process.env.P6B_EDGE_WAF_RETRY_MS || 15_000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verify() {
  const internal = await fetch(`${ORIGIN}/api/internal/p6b-probe`, {
    redirect: "manual",
    headers: { "Cache-Control": "no-cache" }
  });
  if (internal.status !== 403 || internal.headers.get("x-rcat-edge-waf") !== MARKER) {
    return false;
  }

  const crossSite = await fetch(`${ORIGIN}/api/cms-auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://p6b-probe.invalid",
      "Sec-Fetch-Site": "cross-site",
      "Cache-Control": "no-cache"
    },
    body: "{}"
  });
  if (crossSite.status !== 403 || crossSite.headers.get("x-rcat-edge-waf") !== MARKER) {
    return false;
  }

  const sameOrigin = await fetch(`${ORIGIN}/api/cms-auth/session`, {
    redirect: "manual",
    headers: {
      "Sec-Fetch-Site": "same-origin",
      "Cache-Control": "no-cache"
    }
  });
  if (sameOrigin.headers.get("x-rcat-edge-waf") !== MARKER || sameOrigin.status === 403) {
    return false;
  }

  return true;
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    if (await verify()) {
      console.log("P6B Vercel edge WAF production smoke: PASS.");
      process.exit(0);
    }
  } catch {
    // Deployment propagation can transiently fail while the new Vercel build is becoming active.
  }

  if (attempt < MAX_ATTEMPTS) await sleep(RETRY_MS);
}

console.error("P6B Vercel edge WAF production smoke: expected edge policy was not observed before timeout.");
process.exit(1);
