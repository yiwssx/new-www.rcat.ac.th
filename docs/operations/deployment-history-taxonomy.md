# Deployment History Taxonomy

Updated: 2026-09-13.

GitHub deployment history is reserved for real production runtime mutations. The protected GitHub Environment named `production` remains the credential and approval boundary, but verification-only jobs declare `deployment: false` so they do not create generic pseudo-deployment records.

External deployments use service-specific history names:

- Vercel frontend: `production` records emitted by the Vercel Git integration from `master`.
- Google Apps Script media bridge: `apps-script-production`, emitted only when the release or rollback workflow mutates the existing Web App deployment.
- Cloudflare Worker runtime: `cloudflare-production`, emitted only when the release or rollback workflow mutates the production Worker.

Preflight, observability, security diagnostics, D1 recovery readiness, data-integrity checks, authenticated field verification, link audits, and metadata maintenance may use protected production secrets but must not publish deployment records.

`Deployment History Maintenance` removes deployment records whose latest status is `failure` or `error`, plus legacy generic `production` pseudo-deployments emitted by GitHub Actions. Successful Vercel and service-specific deployment records are preserved.
