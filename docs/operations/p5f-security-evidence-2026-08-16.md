# P5F Security Evidence — 2026-08-16

Status: implementation candidate. P5F closes only after CI is green, the dedicated production read token is provisioned, and the read-only production workflows succeed with that token.

## Scope

P5F has two bounded goals:

1. stop read-only Cloudflare/D1 workflows from receiving the privileged production deploy/write token;
2. begin evidence collection across the seven CSP surfaces without changing CSP from Report-Only to enforcement.

P5F does not rename or recreate the canonical production Worker/D1, move production data, change public/admin API URLs, change Vercel environment variables, deploy Apps Script, or perform a D1 restore.

## Cloudflare credential boundary

The protected GitHub `production` Environment owns two token roles:

- `CLOUDFLARE_D1_READ_TOKEN`: dedicated account-scoped token with **D1 Read** only. It is used by read-only D1 inspection paths.
- `CLOUDFLARE_API_TOKEN`: privileged production release/write token. It remains limited to workflows that can apply migrations, clean confirmed fixtures, or deploy the Worker. Its required Cloudflare capabilities are D1 write plus Workers Scripts write/edit; it must not gain unrelated Zone, KV, R2, token-management, or other account permissions merely for convenience.

Both token roles remain outside source control. `CLOUDFLARE_ACCOUNT_ID` and `RCAT_PRODUCTION_D1_DATABASE_ID` remain protected Environment secrets. The physical production resource is still intentionally named `rcat-public-api-preview`; the protected production D1 UUID remains authoritative.

Workflow ownership after P5F:

| Workflow / mode | Credential role | Write capability in workflow |
| --- | --- | --- |
| Worker Production Preflight | `CLOUDFLARE_D1_READ_TOKEN` | none |
| D1 Recovery Drill | `CLOUDFLARE_D1_READ_TOKEN` | none |
| Production Data Integrity — `audit` | `CLOUDFLARE_D1_READ_TOKEN` | none |
| Production Data Integrity — `cleanup` | `CLOUDFLARE_API_TOKEN` | exact guarded D1 deletes only |
| Worker Production Release | `CLOUDFLARE_API_TOKEN` | migration apply + Worker deployment |

`scripts/check-p5f-security-boundary.mjs` fails CI if the pure read-only workflows regain the privileged token, if Data Integrity audit/cleanup token selection loses its mode boundary, or if the Worker release path starts consuming the read-only token.

## Dedicated read-token provisioning

Create one Cloudflare custom API token scoped to the same account that contains the canonical production D1 and grant only **Account → D1 → Read**. Do not grant Workers Scripts Edit, D1 Edit, Zone permissions, API Tokens permissions, KV, R2, or unrelated products.

Store it only as the protected GitHub Environment secret `CLOUDFLARE_D1_READ_TOKEN` under `production`. Do not replace `CLOUDFLARE_API_TOKEN`; the privileged token remains required for explicit cleanup/migration/release/deploy operations.

After provisioning, validate from `master` with these non-destructive runs:

1. **Worker Production Preflight** — must resolve exact D1 identity, current Time Travel bookmark, and unapplied migration list with no write/deploy/restore command.
2. **D1 Recovery Drill** — acknowledge the read-only production drill; it must resolve D1 metadata and Time Travel bookmark, then retire only its GitHub Environment pseudo-deployment.
3. **Production Data Integrity** with `mode=audit` — must inspect schema and exact fixture sentinels without cleanup.

A missing or insufficient read token is a P5F access-boundary failure. Do not bypass it by restoring the privileged token to a read-only workflow.

## CSP seven-surface evidence

Machine-readable evidence is recorded in `config/csp-production-evidence.json`. The evidence was collected from production custom-domain traffic after Cloudflare Edge processing, plus sanitized browser CSP reports emitted by `/api/csp-report`.

| Surface | Representative path | State | Evidence/result |
| --- | --- | --- | --- |
| Public SSR | `/` | blocked | inline TanStack SSR script; GTM script; YouTube and Google Maps frames reported by browser |
| Public navigation | `/search` | blocked | inline SSR script and GTM reported by browser |
| Auth | `/login` | pending | post-P5E Edge response is 200 and carries Report-Only policy; browser sample still required |
| Admin | `/admin` | pending | post-P5E Edge response is 200 and carries Report-Only policy; authenticated browser sample still required |
| Media | `/admin/media` | pending | post-P5E Edge response is 200 and carries Report-Only policy; authenticated media sample still required; separate public content reports show Google Drive frame requirement |
| Complaint | `/complaint` | blocked | post-P5E Edge HTML contains TanStack inline SSR stream script while delivered policy keeps `script-src 'self'` |
| Facebook embed | representative `/content/facebook-*` route | blocked | inline SSR and GTM reported; no Facebook frame violation in the captured sample, which is not sufficient to call the surface clean |

The current evidence deliberately does **not** mark a surface clean merely because no retained report was found.

## CSP classification and next remediation

Observed requirements fall into reproducible buckets:

- **SSR inline scripts:** TanStack Router emits inline hydration/stream scripts. Before enforcement, use supported nonce/hash handling; do not add `unsafe-eval` to silence reports.
- **Public telemetry:** the application intentionally loads Google Tag Manager, but the current report-only `script-src` does not allow its origin. Confirm the telemetry contract and then authorize only the exact required origins or remove the dependency.
- **Embedded frames:** homepage/content currently needs selected YouTube no-cookie, Google Maps, and Google Drive frame origins. Add only confirmed exact origins when the policy is revised; do not broaden `frame-src` to all `https:`.
- **Browser/extension noise:** continue classifying separately when observed; do not widen application policy for extension-only sources.

P5F leaves `Content-Security-Policy-Report-Only` active and `approvedForEnforcement=false`. Moving to enforcing `Content-Security-Policy` is a separate evidence-driven change after all seven surfaces have representative browser evidence, blockers are remediated, and rollback is ready.

## Closure checklist

P5F is complete when:

- the dedicated `CLOUDFLARE_D1_READ_TOKEN` exists in the protected production Environment with D1 Read only;
- pure read-only workflows no longer reference `secrets.CLOUDFLARE_API_TOKEN`;
- Data Integrity audit uses the read token while cleanup retains the privileged token;
- the three read-only validation runs succeed from `master`;
- all seven CSP surfaces have an explicit evidence record (blocked/pending/clean) without false-clean inference;
- CSP remains Report-Only and `unsafe-eval` is absent;
- CI governance passes the P5F regression gate.
