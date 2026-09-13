from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(text, encoding="utf-8")


workflows = [
    ".github/workflows/cms-link-integrity-audit.yml",
    ".github/workflows/apps-script-production-preflight.yml",
    ".github/workflows/p6b-production-security.yml",
    ".github/workflows/apps-script-production-rollback.yml",
    ".github/workflows/production-observability.yml",
    ".github/workflows/apps-script-production-release.yml",
    ".github/workflows/d1-recovery-drill.yml",
    ".github/workflows/worker-production.yml",
    ".github/workflows/worker-production-preflight.yml",
    ".github/workflows/worker-production-rollback.yml",
    ".github/workflows/production-data-integrity.yml",
    ".github/workflows/phase-c3-authenticated-cms-field.yml",
    ".github/workflows/facebook-metadata-reclassification.yml",
]

for path in workflows:
    source = read(path)
    rewritten, count = re.subn(
        r"(?m)^(\s*)environment: production\s*$",
        lambda m: f"{m.group(1)}environment:\n{m.group(1)}  name: production\n{m.group(1)}  deployment: false",
        source,
    )
    if count != 1:
        raise SystemExit(f"expected exactly one production environment in {path}, found {count}")
    write(path, rewritten)

for path in [
    ".github/workflows/p6b-production-security.yml",
    ".github/workflows/production-observability.yml",
    ".github/workflows/d1-recovery-drill.yml",
]:
    source = read(path)
    marker = "\n  retire-environment-deployment:"
    if marker not in source:
        raise SystemExit(f"cleanup job marker missing in {path}")
    write(path, source.split(marker, 1)[0].rstrip() + "\n")

helper = r'''import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const environment = process.env.DEPLOYMENT_ENVIRONMENT;

if (!token || !repository || !environment) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, and DEPLOYMENT_ENVIRONMENT are required");
}

async function github(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${body?.message || text || response.statusText}`);
  }
  return body;
}

async function start() {
  const ref = process.env.GITHUB_SHA;
  if (!ref) throw new Error("GITHUB_SHA is required");
  const description = process.env.DEPLOYMENT_DESCRIPTION || `${environment} release`;
  const deployment = await github(`/repos/${repository}/deployments`, {
    method: "POST",
    body: JSON.stringify({
      ref,
      environment,
      auto_merge: false,
      required_contexts: [],
      description,
      production_environment: true,
      transient_environment: false
    })
  });
  const logUrl = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await github(`/repos/${repository}/deployments/${deployment.id}/statuses`, {
    method: "POST",
    body: JSON.stringify({
      state: "in_progress",
      environment,
      log_url: logUrl,
      description: "External production mutation in progress"
    })
  });
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `deployment_id=${deployment.id}\n`);
  }
  console.log(`Started ${environment} deployment record ${deployment.id}.`);
}

async function finish() {
  const deploymentId = process.env.DEPLOYMENT_ID;
  if (!deploymentId) throw new Error("DEPLOYMENT_ID is required");
  const jobStatus = (process.env.JOB_STATUS || "failure").toLowerCase();
  const state = jobStatus === "success" ? "success" : jobStatus === "cancelled" ? "inactive" : "failure";
  const logUrl = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await github(`/repos/${repository}/deployments/${deploymentId}/statuses`, {
    method: "POST",
    body: JSON.stringify({
      state,
      environment,
      log_url: logUrl,
      description: `External production mutation ${state}`
    })
  });
  console.log(`Finalized ${environment} deployment record ${deploymentId} as ${state}.`);
}

const command = process.argv[2];
if (command === "start") await start();
else if (command === "finish") await finish();
else throw new Error("Usage: github-deployment-record.mjs <start|finish>");
'''
write(".github/scripts/github-deployment-record.mjs", helper)

real_deployments = {
    ".github/workflows/apps-script-production-release.yml": {
        "environment": "apps-script-production",
        "description": "Apps Script production release",
        "marker": "      - name: Update only the existing production Web App deployment\n",
        "label": "Apps Script",
    },
    ".github/workflows/apps-script-production-rollback.yml": {
        "environment": "apps-script-production",
        "description": "Apps Script production rollback",
        "marker": "      - name: Point existing deployment at rollback version\n",
        "label": "Apps Script",
    },
    ".github/workflows/worker-production.yml": {
        "environment": "cloudflare-production",
        "description": "Cloudflare Worker production release",
        "marker": "      - name: Apply pending migrations and deploy production Worker\n",
        "label": "Cloudflare Worker",
    },
    ".github/workflows/worker-production-rollback.yml": {
        "environment": "cloudflare-production",
        "description": "Cloudflare Worker production rollback",
        "marker": "      - name: Deploy runtime rollback without D1 migration\n",
        "label": "Cloudflare Worker",
    },
}

for path, cfg in real_deployments.items():
    source = read(path)
    permissions = "permissions:\n  contents: read\n"
    if permissions not in source:
        raise SystemExit(f"permissions anchor missing in {path}")
    source = source.replace(permissions, permissions + "  deployments: write\n", 1)
    marker = cfg["marker"]
    if marker not in source:
        raise SystemExit(f"deployment mutation marker missing in {path}")
    start_step = f'''      - name: Start GitHub {cfg["label"]} production deployment record
        id: github_deployment
        env:
          GITHUB_TOKEN: ${{{{ github.token }}}}
          DEPLOYMENT_ENVIRONMENT: {cfg["environment"]}
          DEPLOYMENT_DESCRIPTION: {cfg["description"]}
        run: node .github/scripts/github-deployment-record.mjs start

'''
    source = source.replace(marker, start_step + marker, 1)
    finish_step = f'''
      - name: Finalize GitHub {cfg["label"]} production deployment record
        if: ${{{{ always() && steps.github_deployment.outputs.deployment_id != '' }}}}
        env:
          GITHUB_TOKEN: ${{{{ github.token }}}}
          DEPLOYMENT_ID: ${{{{ steps.github_deployment.outputs.deployment_id }}}}
          DEPLOYMENT_ENVIRONMENT: {cfg["environment"]}
          JOB_STATUS: ${{{{ job.status }}}}
        run: node .github/scripts/github-deployment-record.mjs finish
'''
    source = source.rstrip() + finish_step + "\n"
    write(path, source)

governance = read("scripts/check-p5g-apps-script-release-governance.mjs")
old = '''  if (!source.includes("environment: production")) {
    fail(`${name} workflow must use the protected production Environment`);
  }
'''
new = '''  if (!source.includes("name: production") || !source.includes("deployment: false")) {
    fail(`${name} workflow must use the protected production Environment without creating a generic deployment record`);
  }
'''
if old not in governance:
    raise SystemExit("Apps Script governance environment assertion anchor missing")
governance = governance.replace(old, new, 1)
insert = '''
if (!release.includes("DEPLOYMENT_ENVIRONMENT: apps-script-production")) {
  fail("release workflow must publish Apps Script deployments under apps-script-production");
}
if (!rollback.includes("DEPLOYMENT_ENVIRONMENT: apps-script-production")) {
  fail("rollback workflow must publish Apps Script deployments under apps-script-production");
}
'''
anchor = 'if (!release.includes("DEPLOY_EXISTING_APPS_SCRIPT_WEB_APP")) {'
if anchor not in governance:
    raise SystemExit("Apps Script release governance insertion anchor missing")
governance = governance.replace(anchor, insert + "\n" + anchor, 1)
write("scripts/check-p5g-apps-script-release-governance.mjs", governance)

targeted_tests = {
    "src/test/phaseCDeepFieldVerificationContract.test.ts": [
        ('expect(phaseC3Workflow).toContain("environment: production");', 'expect(phaseC3Workflow).toContain("name: production");\n    expect(phaseC3Workflow).toContain("deployment: false");'),
    ],
    "src/test/productionDataIntegritySafety.test.ts": [
        ('expect(integrityWorkflow).toMatch(/environment:\\s*production/);', 'expect(integrityWorkflow).toContain("name: production");\n    expect(integrityWorkflow).toContain("deployment: false");'),
    ],
    "src/test/workerProductionPreflightSafety.test.ts": [
        ('expect(preflightWorkflow).toMatch(/environment:\\s*production/);', 'expect(preflightWorkflow).toContain("name: production");\n    expect(preflightWorkflow).toContain("deployment: false");'),
    ],
}
for path, replacements in targeted_tests.items():
    source = read(path)
    for old, new in replacements:
        if old not in source:
            raise SystemExit(f"test assertion anchor missing in {path}: {old}")
        source = source.replace(old, new, 1)
    write(path, source)

taxonomy_test = r'''// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const protectedWorkflows = [
  "cms-link-integrity-audit.yml",
  "apps-script-production-preflight.yml",
  "p6b-production-security.yml",
  "apps-script-production-rollback.yml",
  "production-observability.yml",
  "apps-script-production-release.yml",
  "d1-recovery-drill.yml",
  "worker-production.yml",
  "worker-production-preflight.yml",
  "worker-production-rollback.yml",
  "production-data-integrity.yml",
  "phase-c3-authenticated-cms-field.yml",
  "facebook-metadata-reclassification.yml"
];

const workflow = (name: string) => read(`.github/workflows/${name}`);

describe("GitHub deployment history taxonomy", () => {
  it("uses production as a protected credential gate without generic pseudo-deployments", () => {
    for (const name of protectedWorkflows) {
      const source = workflow(name);
      expect(source, name).toContain("name: production");
      expect(source, name).toContain("deployment: false");
      expect(source, name).not.toContain("environment: production");
    }
  });

  it("tracks only real external runtime mutations in service-specific deployment environments", () => {
    for (const name of ["apps-script-production-release.yml", "apps-script-production-rollback.yml"]) {
      expect(workflow(name)).toContain("DEPLOYMENT_ENVIRONMENT: apps-script-production");
    }
    for (const name of ["worker-production.yml", "worker-production-rollback.yml"]) {
      expect(workflow(name)).toContain("DEPLOYMENT_ENVIRONMENT: cloudflare-production");
    }
  });

  it("does not retain legacy pseudo-deployment retirement jobs", () => {
    for (const name of ["p6b-production-security.yml", "production-observability.yml", "d1-recovery-drill.yml"]) {
      expect(workflow(name)).not.toContain("retire-environment-deployment");
    }
  });
});
'''
write("src/test/deploymentHistoryTaxonomy.test.ts", taxonomy_test)

cleanup_script = r'''import fs from "node:fs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const dryRun = process.env.DRY_RUN === "true";

if (!token || !repository) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");

async function github(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${body?.message || text || response.statusText}`);
  return body;
}

async function listDeployments() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${repository}/deployments?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

function isLegacyActionsPseudoDeployment(deployment) {
  if (String(deployment.environment || "").toLowerCase() !== "production") return false;
  const login = String(deployment.creator?.login || "").toLowerCase();
  const app = String(deployment.performed_via_github_app?.slug || "").toLowerCase();
  return login === "github-actions[bot]" || app === "github-actions";
}

const deployments = await listDeployments();
let failed = 0;
let pseudo = 0;
let deleted = 0;

for (const deployment of deployments) {
  const statuses = await github(`/repos/${repository}/deployments/${deployment.id}/statuses?per_page=1`);
  const latestState = statuses[0]?.state || "pending";
  const failedHistory = latestState === "failure" || latestState === "error";
  const legacyPseudo = isLegacyActionsPseudoDeployment(deployment);
  if (!failedHistory && !legacyPseudo) continue;

  if (failedHistory) failed += 1;
  if (legacyPseudo) pseudo += 1;
  console.log(`${dryRun ? "Would delete" : "Deleting"} deployment ${deployment.id}: environment=${deployment.environment} state=${latestState} creator=${deployment.creator?.login || "unknown"}`);
  if (dryRun) continue;

  if (latestState !== "inactive") {
    await github(`/repos/${repository}/deployments/${deployment.id}/statuses`, {
      method: "POST",
      body: JSON.stringify({
        state: "inactive",
        environment: deployment.environment,
        description: "Deployment history taxonomy cleanup"
      })
    });
  }
  await github(`/repos/${repository}/deployments/${deployment.id}`, { method: "DELETE" });
  deleted += 1;
}

const summary = [
  "## Deployment History Maintenance",
  "",
  `- Examined: ${deployments.length}`,
  `- Failed/error records matched: ${failed}`,
  `- Legacy GitHub Actions production pseudo-deployments matched: ${pseudo}`,
  `- Deleted: ${deleted}`,
  `- Dry run: ${dryRun}`,
  "- Successful Vercel and service-specific deployment records are preserved"
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
'''
write(".github/scripts/cleanup-deployment-history.mjs", cleanup_script)

cleanup_workflow = r'''name: Deployment History Maintenance

on:
  push:
    branches:
      - master
    paths:
      - ".github/workflows/deployment-history-maintenance.yml"
      - ".github/scripts/cleanup-deployment-history.mjs"
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Inspect matches without deleting deployment records"
        required: false
        default: false
        type: boolean

permissions:
  contents: read
  deployments: write

jobs:
  cleanup:
    name: Clean Failed and Legacy Pseudo-Deployments
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
      - name: Remove failed/error history and legacy generic production pseudo-deployments
        env:
          GITHUB_TOKEN: ${{ github.token }}
          DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run || false }}
        run: node .github/scripts/cleanup-deployment-history.mjs
'''
write(".github/workflows/deployment-history-maintenance.yml", cleanup_workflow)

deployment_doc = '''# Deployment History Taxonomy

Updated: 2026-09-13.

GitHub deployment history is reserved for real production runtime mutations. The protected GitHub Environment named `production` remains the credential and approval boundary, but verification-only jobs declare `deployment: false` so they do not create generic pseudo-deployment records.

External deployments use service-specific history names:

- Vercel frontend: `production` records emitted by the Vercel Git integration from `master`.
- Google Apps Script media bridge: `apps-script-production`, emitted only when the release or rollback workflow mutates the existing Web App deployment.
- Cloudflare Worker runtime: `cloudflare-production`, emitted only when the release or rollback workflow mutates the production Worker.

Preflight, observability, security diagnostics, D1 recovery readiness, data-integrity checks, authenticated field verification, link audits, and metadata maintenance may use protected production secrets but must not publish deployment records.

`Deployment History Maintenance` removes deployment records whose latest status is `failure` or `error`, plus legacy generic `production` pseudo-deployments emitted by GitHub Actions. Successful Vercel and service-specific deployment records are preserved.
'''
write("docs/operations/deployment-history-taxonomy.md", deployment_doc)

d1_doc = read("docs/operations/d1-recovery-drill.md")
old_paragraph = "GitHub creates an Environment deployment record whenever a job references the protected `production` environment, even when the job is only using that environment as a credential gate. After the read-only readiness job finishes, a separate cleanup job resolves exactly the Environment deployment created for the current workflow attempt, marks it inactive, and deletes that pseudo-deployment. The workflow run itself remains the audit record. The cleanup job fails closed if it cannot identify exactly one matching deployment and does not interact with Cloudflare resources.\n\nDeployment matching lives in the unit-tested `scripts/resolve-d1-drill-environment-deployment.mjs` helper rather than inline workflow code. It requires the exact master SHA, actor, GitHub Actions app, Environment classification, and run-time window.\n"
new_paragraph = "The read-only readiness job uses the protected `production` Environment with `deployment: false`. GitHub still applies the Environment's credential and approval boundary, but no GitHub Deployment object is created for this verification-only run. The workflow run remains the audit record, and no deployment-history cleanup job is required.\n"
if old_paragraph not in d1_doc:
    raise SystemExit("D1 deployment-history documentation anchor missing")
d1_doc = d1_doc.replace(old_paragraph, new_paragraph, 1)
d1_doc = d1_doc.replace(
    "9. retires and deletes only the GitHub Environment pseudo-deployment created for the current drill attempt while retaining the workflow run as audit evidence.",
    "9. retains the workflow run as audit evidence without creating a GitHub Deployment object.",
)
d1_doc = d1_doc.replace(
    "- whether the transient GitHub Environment deployment record was retired successfully;",
    "- whether the run completed without creating a GitHub Deployment object;",
)
d1_doc = d1_doc.replace(
    "failure to retrieve a Time Travel bookmark, Wrangler command incompatibility, or an ambiguous GitHub Environment deployment match is a drill failure.",
    "failure to retrieve a Time Travel bookmark, or Wrangler command incompatibility is a drill failure.",
)
write("docs/operations/d1-recovery-drill.md", d1_doc)

for transient in [
    ".github/workflows/deployment-taxonomy-bootstrap.yml",
    ".github/workflows/deployment-taxonomy-bootstrap-v2.yml",
    ".github/scripts/deployment-taxonomy-bootstrap.py",
]:
    path = Path(transient)
    if path.exists():
        path.unlink()
