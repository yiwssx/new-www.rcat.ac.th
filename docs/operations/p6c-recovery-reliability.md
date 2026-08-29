# P6C Recovery & Reliability

Status: active.

Started: 2026-08-30.

## Goal

P6C turns the existing production-hardening baseline into an operator-ready recovery system without creating a new provider tier or weakening the protected `production` Environment.

The phase covers:

- unattended public reliability checks that require no production secret;
- D1 point-in-time recovery readiness;
- Cloudflare Worker runtime rollback without reversing D1 migrations;
- Vercel frontend/SSR rollback procedure;
- Apps Script media bridge rollback verification;
- explicit recovery objectives, operator decision points, and closure evidence.

P6C must reuse existing credentials before any new token is considered. A new credential is allowed only when a non-destructive capability check proves that the existing role cannot perform the required operation.

## Recovery objectives

These are operating targets rather than provider SLAs.

| Runtime/data surface | Recovery objective | Data-loss objective | Primary recovery path |
| --- | --- | --- | --- |
| Vercel frontend, SSR, and same-origin proxies | restore service within 30 minutes of rollback decision | source-controlled runtime: zero | Vercel immutable deployment rollback or a validated Git revert on `master` |
| Cloudflare Production Worker runtime | restore a known-good Worker within 30 minutes of rollback decision | runtime code: zero | protected Worker runtime rollback workflow; no migration reversal |
| Canonical production D1 | begin verified point-in-time recovery within 30 minutes of restore approval | target a restore point no more than 5 minutes before the confirmed destructive event when Time Travel history permits | D1 Time Travel using the exact protected production database identity |
| Apps Script media bridge | restore a known immutable Apps Script version within 30 minutes of rollback decision | Drive files are not rewritten by application-code rollback | existing protected Apps Script rollback workflow |
| Dedicated complaint bridge | restore service by reverting Vercel proxy/config or the dedicated Apps Script deployment | submitted upstream records are outside source-control rollback | isolated complaint runbook; never redirect the browser directly to Apps Script |

Cloudflare Time Travel retention is provider/plan dependent. Recovery procedures must always resolve the requested timestamp/bookmark before any destructive restore is approved.

## Runtime recovery boundaries

### Vercel

`master` remains the source deployment branch. Vercel rollback does not require a new repository secret in P6C. Prefer an immutable Vercel deployment rollback for an immediate runtime incident; use a Git revert when source control must permanently represent the restored state.

A Vercel rollback must not silently change Worker/D1 state. After rollback, run the P6C reliability smoke and verify Admin/Auth separately if the incident affected those surfaces.

### Cloudflare Worker

Worker runtime rollback is intentionally separate from D1 recovery. A runtime rollback:

- deploys Worker source/config from a prior ancestor commit;
- injects the current protected production D1 UUID at runtime;
- does **not** run `wrangler d1 migrations apply`;
- does **not** run D1 Time Travel restore;
- requires an exact rollback confirmation and the protected `production` Environment;
- refuses a target that is not an ancestor of the workflow's `master` revision.

This preserves the append-only database history while allowing application runtime code to return to a known-good revision.

### D1

`.github/workflows/d1-recovery-drill.yml` remains read-only. It verifies the exact protected production D1 identity and resolves current Time Travel metadata/bookmark without restoring anything.

A real D1 restore is an incident-only destructive action. Before approving one:

1. identify the confirmed destructive event timestamp;
2. resolve a Time Travel bookmark for a timestamp immediately before that event;
3. capture current production state and the pre-restore timestamp as incident evidence;
4. confirm Worker compatibility with the restored schema/data state;
5. use the privileged production Cloudflare credential only after protected Environment approval;
6. immediately run Worker health, Public SSR/search, Admin/Auth, and data-integrity verification after restore.

Do not execute a destructive production restore merely to prove P6C readiness.

### Apps Script media bridge

`.github/workflows/apps-script-production-rollback.yml` already updates the existing production deployment in place to an immutable prior version, verifies the resulting deployment version, and runs a read-only bridge health smoke. P6C treats that workflow as the canonical media-bridge rollback path.

### Complaint bridge

The complaint Apps Script endpoint remains isolated behind the same-origin Vercel `/api/complaint` proxy. P6C must not introduce a browser-visible Apps Script endpoint or merge the complaint deployment into the CMS media-bridge rollback path.

## Unattended reliability smoke

`.github/workflows/p6c-production-reliability.yml` is intentionally public/read-only and does **not** reference the protected `production` Environment or any secret.

It checks:

- the production home page returns a successful SSR response with the enforcing security baseline;
- production search returns successfully and retains its noindex contract, exercising uncached SSR/Public data dependencies;
- login remains reachable with the Admin/Auth noindex boundary;
- a harmless direct `/api/internal/*` probe is denied by the Vercel edge WAF marker.

A scheduled failure should be treated as an availability signal. It does not authorize an automatic rollback.

## Credential posture

P6C reuses the existing credential separation:

- read-only D1 readiness: `CLOUDFLARE_D1_READ_TOKEN`;
- Worker deploy/runtime rollback and an approved D1 restore: existing privileged `CLOUDFLARE_API_TOKEN`;
- exact D1 identity: `RCAT_PRODUCTION_D1_DATABASE_ID`;
- Apps Script rollback: existing `CLASPRC_JSON`, `CLASP_JSON`, and `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID`.

The phase does not add a Vercel token. GitHub `production` Environment approval remains mandatory for mutating recovery actions.

## Activation gates

P6C is complete only after all of the following are evidenced:

1. repository CI and the P6C governance check pass on the final implementation;
2. the unattended production reliability workflow is merged and one production run passes;
3. the D1 read-only recovery drill passes against the canonical production database;
4. the Worker runtime rollback workflow passes static/governance validation and its production credential/identity preflight is proven without performing an unnecessary rollback;
5. the Vercel rollback procedure is verified against the current immutable deployment model without adding a new token;
6. the existing Apps Script rollback path remains governance-valid and credential-gated;
7. the final project-state document records recovery evidence, unresolved provider constraints if any, and the P6C closure decision.

A destructive D1 restore and an actual Worker rollback are **not** required merely to close readiness. They are incident actions and must not be executed against healthy production for drill purposes.

## Rollback decision rule

Do not combine runtime rollback and data restore by default.

- Runtime regression with healthy data: roll back Vercel or Worker only.
- Destructive/corrupt D1 data event: resolve Time Travel first, then explicitly approve D1 restore.
- Apps Script code regression with healthy Drive data: roll back the Apps Script deployment only.
- Provider outage: do not mutate persistent data merely because health checks fail.

## Current phase state

P6C is active until the activation gates above are satisfied and closure evidence is merged into the current project-state document.
