import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  throw new Error(`P5G Apps Script release governance failed: ${message}`);
};

const preflight = read(".github/workflows/apps-script-production-preflight.yml");
const release = read(".github/workflows/apps-script-production-release.yml");
const rollback = read(".github/workflows/apps-script-production-rollback.yml");
const packageJson = JSON.parse(read("package.json"));
const readme = read("apps-script/README.md");
const checklist = read("docs/deployment/apps-script-deployment-checklist.md");

for (const [name, source] of [
  ["preflight", preflight],
  ["release", release],
  ["rollback", rollback]
]) {
  if (!source.includes("github.ref == 'refs/heads/master'")) {
    fail(`${name} workflow must run only from master`);
  }
  if (!source.includes("environment: production")) {
    fail(`${name} workflow must use the protected production Environment`);
  }
  for (const secret of ["secrets.CLASPRC_JSON", "secrets.CLASP_JSON", "secrets.APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID"]) {
    if (!source.includes(secret)) {
      fail(`${name} workflow must require ${secret}`);
    }
  }
  if (!source.includes("@google/clasp@3.3.0")) {
    fail(`${name} workflow must pin clasp to 3.3.0`);
  }
  if (!source.includes("apps-script-release-tools.mjs verify-health")) {
    fail(`${name} workflow must verify the production bridge health contract`);
  }
  if (source.includes("delete-deployment") || source.includes("undeploy")) {
    fail(`${name} workflow must never delete a deployment`);
  }
}

if (!release.includes("DEPLOY_EXISTING_APPS_SCRIPT_WEB_APP")) {
  fail("release workflow must require the exact production confirmation phrase");
}
if (!release.includes("push --force")) {
  fail("release workflow must make the whole-project clasp push explicit inside the guarded CI boundary");
}
if (!release.includes("create-version")) {
  fail("release workflow must create an immutable Apps Script version");
}
if (!release.includes('--deploymentId "$APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID"')) {
  fail("release workflow must update the configured existing deployment ID");
}
if (!release.includes('--versionNumber "$VERSION_NUMBER"')) {
  fail("release workflow must pin the existing deployment to the created immutable version");
}

if (!rollback.includes("ROLLBACK_EXISTING_APPS_SCRIPT_WEB_APP")) {
  fail("rollback workflow must require the exact rollback confirmation phrase");
}
if (rollback.includes("push --force") || rollback.includes("create-version")) {
  fail("rollback must only repoint the existing deployment; it must not push source or create a version");
}
if (!rollback.includes('--deploymentId "$APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID"')) {
  fail("rollback workflow must repoint only the configured existing deployment ID");
}

if (preflight.includes("push --force") || preflight.includes("create-version")) {
  fail("production preflight must remain read-only");
}
if (preflight.includes("create-deployment") || preflight.includes("update-deployment")) {
  fail("production preflight must not change a deployment");
}

const gasScripts = Object.entries(packageJson.scripts || {}).filter(([name]) => name.startsWith("gas:"));
for (const [name, command] of gasScripts) {
  if (String(command).includes("push --force")) {
    fail(`${name} must not expose a local force-push production path`);
  }
  if (/\b(?:create-version|create-deployment|update-deployment|deploy|redeploy)\b/.test(String(command))) {
    fail(`${name} must not expose a local Apps Script production deployment path`);
  }
}
if (!packageJson.scripts?.["gas:push:local"]) {
  fail("package.json must retain an explicit non-force local Apps Script push command for development only");
}

for (const document of [readme, checklist]) {
  if (!document.includes("Apps Script Production Release")) {
    fail("Apps Script operations docs must name the canonical production release workflow");
  }
  if (!document.includes("Apps Script Production Rollback")) {
    fail("Apps Script operations docs must name the canonical rollback workflow");
  }
  if (!document.includes("CLASPRC_JSON") || !document.includes("CLASP_JSON")) {
    fail("Apps Script operations docs must document CI credential secrets");
  }
  if (!document.includes("APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID")) {
    fail("Apps Script operations docs must document the existing production deployment ID secret");
  }
}

console.log(
  "P5G Apps Script release governance: master/protected-Environment release, in-place deployment update, rollback, health smoke, and local-production-path guards verified."
);
