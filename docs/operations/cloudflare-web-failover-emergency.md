# Emergency Cloudflare public-site standby and Vercel failover

Incident tracker: [#760](https://github.com/yiwssx/new-www.rcat.ac.th/issues/760). Prepared on 2026-10-29. **Do not treat code or a successful Worker deployment as a production DNS cutover.**

## Scope and boundaries

- Primary remains the original Vercel SSR frontend and same-origin proxy stack.
- Standby is **read-only public React/Vite CSR**, compiled from the same repository. It is **not SSR-equivalent**.
- The existing Cloudflare public API Worker (physical name `rcat-public-api-preview`) and data-bearing D1 are unchanged. The standby fetches public GET/HEAD API data through a Cloudflare Worker **Service Binding**, not database credentials or new migrations.
- Admin/login/MFA, complaint submission, uploads/media write bridge, B3 health aggregation, public analytics POST, sitemap SSR and other Vercel-only endpoints **do not fail over**. They return 503 while serving standby. Do not claim full availability.
- The fallback HTML intentionally has `noindex` because it is the CSR bootstrap, not equivalent SEO markup.
- The gateway calls the original Vercel origin via the existing **orange-cloud proxied DNS route** when configured as a Worker Route. It fails over only public GET/HEAD when the origin returns HTTP 502/503/504 or has a network exception. Other statuses and unsafe methods are not rerouted.

## Two distinct Cloudflare Workers

| Mode      | Worker name        | Purpose                                                             | DNS/production changes from deploy                         |
| --------- | ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| `standby` | `rcat-web-standby` | Public read-only CSR assets + public API GET proxy                  | None; workers.dev only                                     |
| `gateway` | `rcat-web-gateway` | Route-level proxy to Vercel with HTTPS standby on eligible failures | None; route must be attached separately after verification |

Standby uses `worker.mjs` and `wrangler.toml` in the `rcat-digital` account; only **standby** binds `PUBLIC_API` to the local production Worker. The separate-account Gateway uses `gateway-worker.mjs` and `gateway-wrangler.toml` and fetches Standby over public HTTPS with no Service Binding, D1 or Assets. See [Two-account handoff](cloudflare-gateway-two-account-handoff.md).

## Stage 0 — Prepare access WITHOUT changing www

1. Verify Vercel's current www production service and the authoritative Cloudflare zone for `rcat.ac.th` (**currently administered outside this connected account**). Domain governance prohibits changing nameservers, transferring registry management, or migrating the DNS zone. Use only the existing approved zone/account and its delegated operator when route work is authorized. The standby Workers.dev build needs no DNS change.
2. Ensure Cloudflare Workers access is authorized in the same account as `rcat-public-api-preview` (service bindings cannot target an unrelated account).
3. Reuse or verify the existing GitHub repository/environment secrets `CLOUDFLARE_API_TOKEN` (minimal Workers Scripts write/read permissions) and `CLOUDFLARE_ACCOUNT_ID`. Never commit either value. Restrict the token to the correct account and do not grant D1 write permission for this task.
4. The GitHub Actions variable `RCAT_CLOUDFLARE_WORKERS_SUBDOMAIN` defaults to `rcat-digital` based on existing Worker endpoints; verify this against the account and override if necessary. The workflow builds the standby client to call `https://rcat-web-standby.<verified-subdomain>.workers.dev`, where public API GET is safely bridged through `PUBLIC_API`.
5. Protect the `cloudflare-web-standby` GitHub Environment with reviewers as appropriate. `RCAT_ALLOW_GATEWAY_PREVIEW` must remain unset until explicitly reviewing gateway deployment.

## Stage 1 — Deploy public standby; no DNS changes

After the reviewed PR merges into `main`, **a push event automatically deploys only the isolated `rcat-web-standby` workers.dev Worker**. You may also open GitHub Actions → **Emergency Cloudflare Web Standby** → Run workflow (`main`, target=`standby`) to redeploy manually. Neither path adds any DNS records or Worker Routes; no scheduled deployment exists.

Workflow gates: strict pnpm install, `node --test cloudflare/web-failover/worker.node-check.mjs`, `pnpm build`, validate `dist/index.html` with `#root`, Wrangler deploy `--env standby`, HTTP smoke of `/_rcat/failover-health` and `/news`. **Never run the Vercel SSR cutover build** for standby; it renames index.html to csr.html.

Verify the exact deployed URL in the action summary, then use a real browser to check:

- `/`, `/news`, `/announcements`, `/content/<published-slug>` and `/documents` render content; browser Console has no CORS errors.
- `GET /api/public/home` returns JSON and `X-RCAT-Failover: standby-public-api`. Requests do not carry the browser's admin cookies or Authorization header to the Public API binding.
- `/admin`, `/login`, `POST /api/complaint`, `POST /api/public/site-view` return 503 by design; no server-side write fallback.
- Check public image delivery Worker and original Google Drive fallbacks, routing, navigation, and accessible public content.
- Static asset 404 must not return index.html as a successful JavaScript payload.

## Stage 2 — Cross-account Gateway and authorized production cutover

**The authoritative Cloudflare Zone is managed in a separate account**. A Service Binding is not usable across Cloudflare accounts. Do **not** deploy the historical `worker.mjs --env gateway` or attach the `rcat-web-standby` Worker directly as a Route in the authoritative zone: both configurations are invalid for this separation.

The authoritative zone operator must deploy `cloudflare/web-failover/gateway-worker.mjs` via `gateway-wrangler.toml` **inside the authoritative account**. This Gateway fetches only eligible public GET/HEAD through HTTPS to `rcat-web-standby.rcat-digital.workers.dev`. It also routes public `/api/public/*` GET/HEAD when the Vercel Primary fails, without forwarding cookies or credentials. Protected routes and unsafe HTTP methods are never replayed to Standby.

Follow [Two-account handoff and simulation runbook](cloudflare-gateway-two-account-handoff.md) for exact test-stage and production-stage operator actions:

1. Deploy `gateway-test-wrangler.toml` in the authoritative account; no route is created.
2. Register `failover-test.rcat.ac.th` in Vercel, verify the authorized DNS test record and TLS, and have the zone operator add only `failover-test.rcat.ac.th/*` → `rcat-web-gateway-test`.
3. Test `TEST_SIMULATE_503=true` (CSR HTML, JSON, no write replay) then redeploy test config with `TEST_SIMULATE_503=false` (Vercel SSR healthy return).
4. Only after approval, deploy `gateway-wrangler.toml` in the authoritative account. Its config has **no routes or DNS changes**.
5. The operator may then attach `www.rcat.ac.th/*` → `rcat-web-gateway` as a Worker **Route**, not a Worker Custom Domain. Preserve existing Vercel DNS and SSL.

Never change NS, transfer the .ac.th domain, activate pending unrelated zones or automate production www routing without the existing zone administrator.

## Rollback and limitations

- To disable failover: remove the `www.rcat.ac.th/*` Worker Route; leave the original Vercel DNS origin unchanged. Confirm HTTPS, redirect behavior, SSR HTML metadata, and Admin session on the original Vercel route.
- Never delete or recreate `rcat-public-api-preview`, overwrite its binding configuration, expose D1 UUID, or alter production Apps Script endpoints during standby deployment.
- Automatic Gateway adds Worker invocations to **every** incoming request on the matching www Route; on Workers Free, the 100,000-request/day limit is shared across Workers. Monitor usage and plan Workers Paid if necessary. It does **not** eliminate Vercel SSR CPU use while the primary is healthy.
- Both frontend origins depend on the same Public API Worker and D1. This is Vercel-specific failover, not a Cloudflare outage solution.
- CSR standby cannot guarantee crawler indexing, original SSR status codes, canonical metadata, 404 semantics, or Admin functionality. These require a subsequent Workers SSR and proxy parity migration.
- Do not trigger failover based on an isolated 401/403/404; that would conceal real application authorization or not-found behavior.

## Acceptance and tracking

Code-ready requires passing unit tests and build on PR. Cloudflare-ready requires verified workers.dev smoke and public read behavior. Production-ready additionally requires approved DNS-route configuration, simulated failure, healthy-origin pass-through, return-from-failure, cost monitoring, and rollback verification. The current task must not be marked complete for automated failover until those live checks pass.

## Current DNS inventory note (2026-10-29)

Connected Cloudflare account `admin@rcat.ac.th` was initially missing zone `rcat.ac.th`. A new **pending** full zone was created for preparation only; its nameservers are `roan.ns.cloudflare.com` and `serena.ns.cloudflare.com`. The Cloudflare zone reports **original authoritative nameservers** `maria.ns.cloudflare.com` and `kirk.ns.cloudflare.com`, indicating an **existing Cloudflare zone in a different account**. Its 17 scanned records include Google MX and CNAMEs, while the scanned `www` address records resolve to Cloudflare IP addresses, not reliable Vercel origin addresses. **Do not activate the pending zone or change registrar nameservers.** **Institutional restriction confirmed:** Do not attempt any zone migration, registrar transfer, nameserver replacement, or alternate-zone activation. The pending zone is inert and must never be used as the www traffic origin. Any eventual same-hostname routing requires the explicitly authorized operator of the existing `maria`/`kirk` Cloudflare zone; if that access is not available, provide the verified independent `workers.dev` emergency public URL and do not claim automatic failover for `www.rcat.ac.th`.

## Institutionally enforced domain governance (confirmed by owner)

- `rcat.ac.th` is an institution-controlled `.ac.th` domain administered through an authorized government-recognized domain-management organization. **Do not change** delegation, nameservers, registrant/registrar, DNS zone ownership, or any authoritative records as part of this emergency work.
- Creating a Cloudflare Worker on the `rcat-digital.workers.dev` hostname is independent of this protected domain and is allowed by project scope.
- A Cloudflare Workers Route for `www.rcat.ac.th/*` can only be configured **inside the existing authoritative Cloudflare account/zone**, by its approved administrator; the separately connected Workers account cannot install that route merely by knowing the URL.
- If the organization cannot provide access/approval to that existing Cloudflare zone, **automatic failover on the unchanged `www.rcat.ac.th` URL is blocked**. Escalate availability to the Vercel plan/support and offer the independent Workers.dev public standby URL after smoke tests. Do not imply that an inactive Cloudflare zone enables a live failover.

## After-deploy live smoke (2026-10-29)

A successful Cloudflare Wrangler upload and a 200 response from the Worker health endpoint do **not** demonstrate that the React application hydrated or that the Public API returned usable data. The `Emergency Cloudflare Web Standby` GitHub workflow now runs `cloudflare/web-failover/standby-smoke.mjs` after deployment. Its read-only checks cover:

- `/_rcat/failover-health` status and standby mode;
- `/news` CSR HTML, `noindex`, and the real content-hashed JavaScript asset;
- `/api/public/home` and `/api/public/shell` JSON/CORS through the existing service binding;
- `/admin`, `/api/cms-auth/session`, and `/sitemap.xml` returning 503;
- GET-only API CORS preflight and Chromium hydration on `/` and `/news`.

The smoke script rejects any base URL outside the isolated `rcat-web-standby.*.workers.dev` hostname, so it must not be run against `www.rcat.ac.th`. A failing smoke leaves the last uploaded standalone Worker available for investigation but **does not certify standby readiness**. The GitHub Actions job must conclude success before marking the live browser/API verification complete in Issue #760.
