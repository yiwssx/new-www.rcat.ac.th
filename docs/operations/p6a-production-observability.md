# P6A Production Observability

Status: new requested work under the post-P5H production governance baseline.

## Goal

P6A adds an operator-facing production observability guard without changing the application runtime, D1 schema, Worker routing, authentication model, or production data.

The first guard targets Cloudflare D1 account usage because daily rows-read and rows-written limits can stop queries for the remainder of the UTC billing day when a Workers Free account exceeds its allowance.

## Data Source

The monitor queries Cloudflare's GraphQL Analytics API using the `d1AnalyticsAdaptiveGroups` dataset. It reads account-level D1 metrics for a 14-day lookback window and evaluates the current UTC billing day.

The workflow does not execute SQL against D1, does not write D1 data, and does not call a Worker endpoint. Querying analytics therefore does not add D1 rows read or rows written.

## Credential Boundary

The workflow uses the existing protected GitHub `production` Environment only as a credential gate.

Required secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ANALYTICS_READ_TOKEN`

`CLOUDFLARE_ANALYTICS_READ_TOKEN` must be a dedicated Cloudflare API token scoped to **Account > Account Analytics > Read**. Do not substitute the Worker deploy token or another write-capable production token merely to make monitoring pass.

Because referencing a GitHub Environment creates a pseudo-deployment record, the workflow retires and deletes only the Environment deployment created for its own run. The workflow run remains the audit record.

## Schedule And Thresholds

`.github/workflows/production-observability.yml` runs every two hours at minute 17 and can also be started manually from `master`.

Default daily limits match the Workers Free D1 allowance:

- rows read: `5,000,000`
- rows written: `100,000`

Default utilization bands:

- below 50%: `healthy`
- 50% to below 70%: `info`
- 70% to below 85%: `warning`
- 85% and above: `critical`

A warning or critical result fails the workflow so normal GitHub Actions failure notifications can surface the condition before the daily limit is exhausted. An informational result emits a workflow notice but remains successful.

The limits and thresholds can be overridden with protected Environment variables:

- `D1_DAILY_ROWS_READ_LIMIT`
- `D1_DAILY_ROWS_WRITTEN_LIMIT`
- `D1_USAGE_INFO_RATIO`
- `D1_USAGE_WARNING_RATIO`
- `D1_USAGE_CRITICAL_RATIO`

If the Cloudflare account moves to a different billing plan, update the configured limits before relying on the percentage bands.

## Privacy Boundary

The monitor deliberately does not print or persist:

- Cloudflare account IDs;
- D1 database IDs;
- API tokens;
- raw SQL/query text;
- request URLs;
- user identity or session data;
- raw account usage counts.

Workflow output contains utilization percentages and severity only. The transient JSON report is written into the runner temporary directory and is not uploaded as an artifact.

## Operational Interpretation

Use the guard as a secondary safety signal, not as a replacement for Cloudflare's own Billing and D1 Metrics dashboards.

When a warning or critical run occurs:

1. confirm rows-read and rows-written usage in the Cloudflare dashboard;
2. determine whether the increase is expected traffic or an abnormal workload;
3. inspect D1 query insights for the largest read/write contributors;
4. compare the change with recent application releases;
5. avoid emergency schema or billing changes until the source of the increase is understood.

Cloudflare native billing notifications for Rows Read and Rows Written should also be enabled as the account-level primary alert channel when available.

## Activation Gate

P6A monitoring is operational only after all of the following are true:

- repository CI is green;
- the workflow is merged to `master`;
- `CLOUDFLARE_ANALYTICS_READ_TOKEN` exists in the protected production Environment with Account Analytics Read only;
- one manual **Production Observability** run succeeds from `master`;
- the Environment pseudo-deployment cleanup succeeds;
- the first successful run reports the expected current UTC-day utilization without exposing protected identifiers.
