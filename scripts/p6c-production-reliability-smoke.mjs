const baseUrl = new URL(process.env.P6C_PRODUCTION_BASE_URL || "https://www.rcat.ac.th/");
const timeoutMs = Number(process.env.P6C_RELIABILITY_TIMEOUT_MS || 15000);

function fail(message) {
  throw new Error(`P6C production reliability smoke failed: ${message}`);
}

async function request(pathname, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      redirect: "manual",
      signal: controller.signal,
      ...options
    });
    return response;
  } catch (error) {
    if (error?.name === "AbortError") {
      fail(`${pathname} exceeded ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requireHeader(response, name, predicate, message) {
  const value = response.headers.get(name) || "";
  if (!predicate(value)) {
    fail(`${message}; ${name}=${value || "<missing>"}`);
  }
}

async function checkHome() {
  const response = await request("/");
  if (response.status !== 200) {
    fail(`/ expected 200, received ${response.status}`);
  }
  requireHeader(
    response,
    "content-security-policy",
    (value) => value.includes("default-src 'self'") && value.includes("report-uri /api/csp-report"),
    "home response must retain enforcing CSP"
  );
  requireHeader(
    response,
    "x-rcat-security-baseline",
    (value) => value === "p6b-enforced-v1",
    "home response must retain the production security baseline marker"
  );
  console.log("P6C reliability: home SSR healthy.");
}

async function checkSearch() {
  const response = await request(`/search?q=${encodeURIComponent("p6c-reliability-probe")}`);
  if (response.status !== 200) {
    fail(`/search expected 200, received ${response.status}`);
  }
  requireHeader(
    response,
    "x-robots-tag",
    (value) => value.toLowerCase().includes("noindex"),
    "search must retain its noindex contract"
  );
  requireHeader(
    response,
    "cache-control",
    (value) => value.toLowerCase().includes("no-store"),
    "search must remain uncached for a live upstream reliability probe"
  );
  console.log("P6C reliability: live search/Worker dependency healthy.");
}

async function checkLogin() {
  const response = await request("/login");
  if (response.status !== 200) {
    fail(`/login expected 200, received ${response.status}`);
  }
  requireHeader(
    response,
    "x-robots-tag",
    (value) => value.toLowerCase().includes("noindex") && value.toLowerCase().includes("nofollow"),
    "login must retain the Admin/Auth noindex boundary"
  );
  console.log("P6C reliability: login surface reachable.");
}

async function checkEdgeWaf() {
  const response = await request("/api/internal/p6c-reliability-probe");
  if (response.status !== 403) {
    fail(`/api/internal probe expected 403, received ${response.status}`);
  }
  requireHeader(
    response,
    "x-rcat-edge-waf",
    (value) => value === "p6b-vercel-v1",
    "internal probe must be denied by the Vercel edge WAF"
  );
  console.log("P6C reliability: edge WAF boundary healthy.");
}

await checkHome();
await checkSearch();
await checkLogin();
await checkEdgeWaf();

console.log("P6C production reliability smoke: PASS.");
