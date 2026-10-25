"use strict";

// This is a bounded, deterministic source-control inventory, NOT a vulnerability finding engine.
// It accepts only explicitly staged files inside the disposable, offline Docker sandbox.
const fs = require("node:fs");

const CHECKS = Object.freeze([
  {
    file: "server/adminProxy/handlers.mjs",
    indicators: ["readCmsSessionCookie", "cmsTokensMatch", "CMS_BROWSER_CSRF_HEADER", "ADMIN_PATH_PREFIX"],
    quick: true
  },
  {
    file: "server/cmsAuth/handlers.mjs",
    indicators: ["readCmsSessionCookie", "cmsTokensMatch", "CMS_NEW_SESSION_TOKEN_HEADER"],
    quick: true
  },
  {
    file: "cloudflare/public-api/src/auth/adminAccess.ts",
    indicators: ["constantTimeTextEqual", "CMS_SESSION_TOKEN_HEADER", "verifyCmsSession"],
    quick: true
  },
  {
    file: "cloudflare/public-api/src/auth/adminRoutePolicy.ts",
    indicators: ["resolveAdminRoutePolicy", "requires("],
    quick: true
  },
  {
    file: "cloudflare/public-api/src/auth/adminCapabilities.ts",
    indicators: ["hasAdminCapability", "ROLE_CAPABILITIES"],
    quick: false
  },
  {
    file: "cloudflare/public-api/src/auth/adminStepUp.ts",
    indicators: ["hasRecentAdminAssurance", "requireAdminStepUp"],
    quick: false
  },
  {
    file: "cloudflare/public-api/src/auth/cmsSessionService.ts",
    indicators: ["requiresCsrf", "session_version", "revoked_at"],
    quick: false
  },
  {
    file: "cloudflare/public-api/src/routes/cmsAuthInternal.ts",
    indicators: ["authenticateSession", "hasAdminCapability", "hasRecentAdminAssurance"],
    quick: false
  }
]);

function evaluate(readSource, profile) {
  if (profile !== "quick" && profile !== "standard") {
    throw new TypeError("profile must be quick or standard");
  }
  const selected = CHECKS.filter((check) => profile === "standard" || check.quick);
  let matched = 0;
  let missing = 0;
  for (const check of selected) {
    let content;
    try {
      content = readSource(check.file);
    } catch {
      missing += check.indicators.length;
      continue;
    }
    if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > 1048576) {
      missing += check.indicators.length;
      continue;
    }
    for (const indicator of check.indicators) {
      if (content.includes(indicator)) {
        matched += 1;
      } else {
        missing += 1;
      }
    }
  }
  return { profile, files: selected.length, matched, missing, status: missing === 0 ? "pass" : "fail" };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) {
      throw new TypeError("exactly one audit profile is required");
    }
    const result = evaluate((file) => fs.readFileSync("/target/" + file, "utf8"), process.argv[2]);
    if (result.status !== "pass") {
      // Never disclose individual source indicators or suspected security gaps in public CI logs.
      console.error("RCAT audit preflight: invariant mismatch; inspect source privately");
      process.exitCode = 1;
    } else {
      console.log(
        "RCAT security control inventory PASS: profile=" +
          result.profile +
          ", source files=" +
          result.files +
          ", indicators=" +
          result.matched
      );
      console.log("STATUS: FULL_AUDIT_INCOMPLETE (no independent agents or verified security findings)");
    }
  } catch {
    console.error("RCAT audit preflight: invalid scope, staged source or runtime");
    process.exitCode = 1;
  }
}

module.exports = { CHECKS, evaluate };
