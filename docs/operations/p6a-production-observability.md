# P6A Production Observability

Status: completed requested work under the post-P5H production governance baseline.

Activation completed: 2026-08-29.

Operational maintenance reviewed: 2026-09-28.

## Goal

P6A adds an operator-facing production observability guard without changing the application runtime, D1 schema, Worker routing, authentication model, or production data.

The first guard targets Cloudflare D1 account usage because daily rows-read and rows-written limits can stop queries for the remainder of the UTC billing day when the applicable allowance is exceeded.

## Data Source

The monitor queries Cloudflare's GraphQL Analytics API using the `d1AnalyticsAdaptiveGroups` dataset. It reads account-level D1 metrics for a 14-day lookback window and evaluates the current UTC billing day.

The workflow does not execute SQL against D1, does not write D1 data, and does not call a Worker endpoint. Querying analytics therefore does not add D1 rows read or rows written.

## Credential Boundary

The guard uses the existing protected GitHub `production` Environment as its credential gate.

Required credentials:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ANALYTICS_READ_TOKEN`

`CLOUDFLARE_ANALYTICS_READ_TOKEN` must remain a dedicated Cloudflare API token scoped to **Account > Account Analytics > Read**. Do not substitute the Worker deploy token or another write-capable production token merely to make monitoring pass.

Do not create a duplicate Environment, duplicate secret, or replacement token solely to bypass the established `production` Environment boundary.

## Current execution path

The current entry point is `.github/workflows/production-verification.yml` on `main`.

Run GitHub Actions → **Production Verification** → **Run workflow** → operation `observability`. The `D1 Usage Guard` job is main-only and uses the protected `production` Environment with `deployment: false`, so verification does not create a GitHub Deployment record.

The former six-hour schedule was retired on 2026-09-20 because reviewer-gated Environment access cannot be approved unattended. Keeping this guard manual-only preserves the credential boundary without creating misleading waiting/cancelled schedule churn.

Default daily limits remain:

- rows read: `5,000,000`
- rows written: `100,000`

Default utilization bands:

- below 50%: `healthy`
- 50% to below 70%: `info`
- 70% to below 85%: `warning`
- 85% and above: `critical`

A warning or critical result fails the job so normal GitHub Actions failure notifications can surface the condition. An informational result emits a notice but remains successful.

The limits and thresholds can be overridden with protected Environment variables:

- `D1_DAILY_ROWS_READ_LIMIT`
- `D1_DAILY_ROWS_WRITTEN_LIMIT`
- `D1_USAGE_INFO_RATIO`
- `D1_USAGE_WARNING_RATIO`
- `D1_USAGE_CRITICAL_RATIO`

If the Cloudflare account moves to a different billing plan, update the configured limits before relying on the percentage bands.

## Privacy Boundary

The monitor deliberately does not print or persist protected account/database identifiers, API tokens, raw SQL/query text, user/session data, or raw account usage counts. Workflow output is limited to the bounded utilization/severity information needed by the operator.

## Operational Interpretation

Use the guard as a secondary safety signal, not as a replacement for Cloudflare's Billing and D1 Metrics dashboards.

When a warning or critical run occurs:

1. confirm rows-read and rows-written usage in the Cloudflare dashboard;
2. determine whether the increase is expected traffic or an abnormal workload;
3. inspect D1 query insights for major read/write contributors;
4. compare the change with recent releases;
5. avoid emergency schema or billing changes until the source is understood.

Cloudflare native billing notifications should remain the account-level primary alert channel when available.

## Historical activation evidence

The original activation gate completed successfully on 2026-08-29 using **Production Observability** run `#15`, attempt `2`, from the then-production `master` branch.

Verified results at that historical checkpoint:

- protected credential gate succeeded;
- Cloudflare D1 analytics query succeeded;
- the run completed successfully;
- the then-applicable Environment pseudo-deployment cleanup succeeded;
- UTC-day utilization at activation was `12.5%` rows read and `0.1%` rows written;
- protected identifiers and raw usage counts were not printed by the guard.

That historical evidence is intentionally preserved. It predates the later workflow consolidation and `master` → `main` migration.

## Current approval-gated operating mode

The GitHub `production` Environment requires reviewer approval. P6A observability is therefore invoked only when an operator intentionally dispatches **Production Verification** with operation `observability` and approves the protected Environment when requested.

The guard is configured and operational when deliberately invoked and approved, but it is not unattended monitoring. Do not weaken the general `production` Environment reviewer requirement merely to make this one job unattended.

## Current operating gate

The observability guard is considered available while:

- repository CI on `main` is green;
- `production-verification.yml` retains the main-only `observability` operation;
- `CLOUDFLARE_ANALYTICS_READ_TOKEN` remains Account Analytics Read only;
- a deliberate manual run can pass the protected credential boundary and analytics query without exposing protected identifiers.

Changes to the execution wrapper do not reopen P6A as an active project phase; project status remains defined by the current architecture/project-state documentation.
