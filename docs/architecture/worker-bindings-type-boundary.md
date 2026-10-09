# Worker binding typing decision — Agent Skills alignment P03

Status: **RETAIN CURRENT OPTIONAL ENV CONTRACT WITH AUTOMATED BINDING-DRIFT GUARD**

Reviewed: 2026-10-09 (Asia/Bangkok)

## Authoritative boundary

- Configuration: `cloudflare/public-api/wrangler.toml`. The local Worker binds local D1 and local rate-limit namespaces. `env.production` preserves the historically named production Worker/D1; the placeholder D1 ID is replaced only through protected release.
- Source typing: `cloudflare/public-api/src/env.ts`. The Worker loads `Env` via explicit imports. All platform bindings are optional because tests and controlled failure paths intentionally provide partial environments.
- Runtime non-secret values may be dashboard-owned (config has `keep_vars = true`); sensitive keys are injected externally. Generating from the committed TOML alone does not prove availability of dashboard vars or secrets.
- Worker tests should continue to verify fail-closed behavior when required bindings or secrets are missing.

## Binding inventory

- **D1:** `DB` uses local D1 for development and the protected existing D1 binding in production; `D1Database?`.
- **Public rate limiting:** `PUBLIC_SITE_VIEW_RATE_LIMITER`, `PUBLIC_PRESENCE_RATE_LIMITER`, and `PUBLIC_CONTENT_VIEW_RATE_LIMITER`; local and production namespaces remain distinct; `RateLimit?`.
- **Security rate limiting:** `RUNTIME_INCIDENT_RATE_LIMITER`, `CMS_AUTH_RATE_LIMITER`, and `ADMIN_API_RATE_LIMITER`; local and production namespaces remain distinct; `RateLimit?`.
- **Production-configured non-secret values:** `ENVIRONMENT` and `PUBLIC_ANALYTICS_ALLOWED_ORIGINS` appear in `env.production.vars`; optional strings in `Env`.
- **Dashboard-/deployment-owned non-secret values:** `PUBLIC_API_ALLOWED_ORIGINS`, `PUBLIC_API_VERSION`, `ADMIN_WRITE_ALLOWED_ORIGINS`, `ENV`, and `CF_PAGES_BRANCH`; optional strings.
- **External secrets:** `CMS_AUTH_PROXY_SECRET`, `CMS_MFA_ENCRYPTION_KEY`, and `CMS_MFA_ENCRYPTION_KEY_VERSION`; optional strings checked at use sites.

## `wrangler types` assessment

`wrangler types` is useful to audit platform bindings, and it should be re-evaluated when the Cloudflare toolchain or binding model changes. A blind replacement of `Env` with a generated all-required interface is **not** approved for this repository because committed TOML does not describe dashboard-managed secrets/vars and the Worker intentionally handles absent bindings in tests and failure paths. This is a scoped exception to the generic vendored Worker recommendation, grounded in RCAT production safety.

The deterministic unit test `cloudflare/public-api/test/workerEnvBindings.test.ts` compares TOML D1/rate-limit names with the declared source contract. It does **not** pretend to confirm the deployed Cloudflare Dashboard state, production binding values or secret configuration. No credential, D1 schema, production config, Worker deployment, or compatibility date is changed.

## Follow-up triggers

Revisit generated binding typing only with a full configured-var/secret matrix, verified Wrangler output on the pinned toolchain, and existing partial-env test compatibility. Any production configuration changes require separate protected authorization.
