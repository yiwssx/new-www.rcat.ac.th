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

function readRobotsMeta(html) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\bname\s*=\s*["']?([^\s"'>]+)/i);
    if (String(nameMatch?.[1] || "").toLowerCase() !== "robots") continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || tag.match(/\bcontent\s*=\s*([^\s>]+)/i);
    return String(contentMatch?.[1] || "").toLowerCase();
  }
  return "";
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
  console.log("P6C reliability: live search/Worker/D1 dependency healthy.");
}

async function checkLogin() {
  const response = await request("/login");
  if (response.status !== 200) {
    fail(`/login expected 200, received ${response.status}`);
  }
  const robots = readRobotsMeta(await response.text());
  if (!robots.includes("noindex") || !robots.includes("nofollow")) {
    fail(`login CSR shell must retain the Admin/Auth noindex boundary; robots meta=${robots || "<missing>"}`);
  }
  console.log("P6C reliability: login CSR shell reachable with robots boundary.");
}

await checkHome();
await checkSearch();
await checkLogin();

console.log("P6C production reliability smoke: PASS.");
