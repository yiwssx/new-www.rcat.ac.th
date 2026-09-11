# CMS Authentication Migration Project Closure

Updated: 2026-09-11.

This document is the final technical handoff for the CMS authentication migration. It preserves the architecture and repository contracts recorded at the original project closure while also recording later operator-confirmed operational completion. For current runtime ownership, provider selection, direct Function inventory, and deployment behavior, `docs/architecture/current-runtime-ownership.md` takes precedence over historical closure-time details in this document.

## 1. Executive summary

The project migrated the CMS from Legacy shared-password authentication to individual CMS accounts. The final system provides:

- D1-backed users and password credentials;
- opaque server Sessions and server-issued Session and CSRF cookies;
- Session-bound CSRF enforcement;
- role and capability authorization;
- password and MFA step-up;
- TOTP MFA and Recovery Codes;
- user lifecycle management;
- authentication and administrative audit logging; and
- CMS-only Admin and media proxies.

The source migration and Phase 8 Legacy runtime retirement are complete. The operator confirmed the final deployment and smoke-test results listed below. On 2026-09-11, the operator also directly inspected the live Vercel and Cloudflare environment configuration and confirmed that the observation-window follow-up and remote Legacy-secret retirement are complete. See `docs/operations/environment-retirement-verification-2026-09-11.md`.

## 2. Final architecture

The structured request path is:

```text
Browser
  → Vercel CMS-auth, Admin, or Apps Script proxy
  → Cloudflare Worker
  → D1
```

The browser authenticates only through `/api/cms-auth/*`. Admin structured operations use `/api/admin-proxy`. Media and file operations use `/api/apps-script-proxy`.

Media business operations follow this path:

```text
Browser
  → /api/apps-script-proxy
  → Worker media authorization probe
  → Apps Script
  → Google Drive
```

Vercel issues and clears the browser cookies, but authentication identity remains D1-authoritative. The Worker validates the opaque Session, active user, Session version, role, capabilities, CSRF token, client metadata, and required step-up assurance before accepting protected work. The media authorization probe authorizes the request without performing a media business write.

## 3. Completed phases

| Phase   | Scope                                                |
| ------- | ---------------------------------------------------- |
| Phase 0 | Legacy hardening                                     |
| Phase 1 | Authentication schema                                |
| Phase 2 | Individual credentials                               |
| Phase 3 | Server Sessions and CSRF                             |
| Phase 4 | Roles and capabilities                               |
| Phase 5 | Lifecycle and audit                                  |
| Phase 6 | MFA and reauthentication                             |
| Phase 7 | React cutover                                        |
| Phase 8 | Final Legacy retirement in code and endpoint routing |

Phase completion did not by itself imply that remote Legacy environment values had been removed. That separate operational retirement was subsequently completed and operator-verified on 2026-09-11.

## 4. Final contracts

The following inventory and migration-count statements record the original CMS-auth closure snapshot; later project evolution may add runtime Functions, capabilities, or migrations without reopening this migration project.

- The repository contained exactly four direct Vercel Functions at CMS-auth closure: `admin-proxy`, `apps-script-proxy`, `cms-auth`, and `sitemap`.
- The Worker defined exactly 44 backend capabilities at CMS-auth closure.
- The frontend defined exactly the same 44 capabilities at CMS-auth closure.
- Retired Legacy Login and Logout paths return finite no-store JSON `410 Gone` tombstones.
- The one-time Root bootstrap route and capability are absent.
- No Legacy authentication, Access identity, smoke-token, proxy-email, or proxy-role fallback remains.
- Phase 8 added no D1 migration; migrations remained through `0013` at CMS-auth closure.
- Existing historical authentication and audit data is retained.

## 5. Acceptance results

The following are **operator-confirmed smoke-test results** from the CMS-auth cutover:

- Root password Login passed.
- Root MFA and TOTP Login passed.
- CMS Session restoration passed.
- Dashboard access passed.
- Capability guards and enforcement passed.
- Admin read and write operations passed.
- CSRF-protected mutation behavior passed.
- `428` reauthentication and step-up behavior passed.
- Integrations smoke testing passed.
- Media upload passed.
- Media delete passed.
- Retired Legacy Login and Logout endpoints returned `410 Gone`.
- Admin Proxy and Apps Script Proxy operated through CMS authentication only.

These results record cutover acceptance. Observation-window completion and remote Legacy-secret retirement were later separately operator-verified on 2026-09-11 in `docs/operations/environment-retirement-verification-2026-09-11.md`.

## 6. Environment handoff

Actual secret values, private identifiers, and private environment URLs must remain outside Git and documentation.

### Required Vercel variables

- `CMS_AUTH_PROXY_SECRET`
- `CLOUDFLARE_ADMIN_API_URL`
- `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_BRIDGE_TOKEN`

The Apps Script URL and bridge token are server-only.

### Required Worker variables

- `CMS_AUTH_PROXY_SECRET`
- `CMS_MFA_ENCRYPTION_KEY`
- `CMS_MFA_ENCRYPTION_KEY_VERSION`
- `ADMIN_WRITE_ALLOWED_ORIGINS`
- `DB` D1 binding

MFA encryption material is Worker-only.

### Public frontend variables at the original closure snapshot

The original CMS-auth closure snapshot documented:

- `VITE_CMS_SITE_NAME`
- `VITE_PUBLIC_SITE_URL`
- `VITE_PUBLIC_API_PROVIDER`
- `VITE_CLOUDFLARE_PUBLIC_API_URL`
- `VITE_PUBLIC_ANALYTICS_STRATEGY`

This list is historical and does not override current environment guidance. In particular, current Public structured data has no `VITE_PUBLIC_API_PROVIDER` runtime selector; see `docs/development/environment-variables.md` and `docs/architecture/current-runtime-ownership.md`.

Every active `VITE_` value is public. No browser variable selects an Admin provider, migration mode, Admin proxy path, or direct Worker Admin origin.

### Retired Legacy variables

The following identifiers belong to retired authentication mechanisms and must not be restored to active runtime code:

- `ADMIN_PROXY_PASSWORD_HASH`
- `ADMIN_PROXY_SESSION_SECRET`
- `ADMIN_PROXY_ALLOWED_EMAILS`
- `ADMIN_RBAC_ADMINS`
- `ADMIN_RBAC_EDITORS`
- `ADMIN_RBAC_VIEWERS`
- `CLOUDFLARE_ADMIN_SMOKE_TOKEN`
- `ADMIN_WRITE_ALLOWED_EMAILS`
- `ADMIN_WRITE_AUTH_MODE`
- `ADMIN_WRITE_PREVIEW_ENABLED`
- `ADMIN_WRITE_SMOKE_ENABLED`
- `ADMIN_WRITE_SMOKE_TOKEN`
- `CMS_AUTH_ENABLED`

Remote retirement of the applicable Legacy-only environment values is complete. On 2026-09-11, the operator directly inspected both Vercel and Cloudflare environment configuration and confirmed the retired values are no longer part of the live Legacy-authentication boundary. See `docs/operations/environment-retirement-verification-2026-09-11.md`.

## 7. Operational responsibilities

- Test Login periodically with a designated secondary Admin account.
- Keep Recovery Codes offline under approved custody controls.
- Maintain and test D1 backup and recovery procedures.
- Monitor Session, authentication, authorization, proxy, and audit logs.
- Rotate shared secrets only through a controlled, coordinated procedure.
- Manage MFA encryption key versions and retain required historical key material according to policy.
- Monitor the Apps Script bridge and Google Drive integration.
- Maintain an incident response procedure for total Root factor loss.
- Record deployment identifiers and rollback targets outside this repository.

## 8. Known limitations

- Automated email delivery is not implemented.
- Invitations are delivered manually through an approved secure channel.
- Password-reset tokens are delivered manually through an approved secure channel.
- Passkeys are deferred.
- Total Root factor loss requires controlled database intervention; there is no HTTP bootstrap or emergency bypass.
- Historical inert Legacy cookies may remain in browsers until their original expiry, but they are not accepted.
- Secret rotation requires coordinated Vercel and Worker changes.
- Rotating `CMS_AUTH_PROXY_SECRET` invalidates current Sessions and outstanding MFA challenges because their metadata hashes depend on that secret. It does not delete MFA factors or Recovery Codes.

## 9. Closure status

| Area                           | Status             | Evidence                                                                                                |
| ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------- |
| Source implementation          | Completed          | Phase commits, final repository audit, and CMS-only runtime paths                                       |
| Automated regression contracts | Completed          | Focused authentication contracts plus full unit and integration suites                                  |
| Vercel build                   | Completed          | Final `pnpm build` verification                                                                         |
| Worker deployment              | Operator confirmed | Phase 8 and final operational smoke testing confirmed by the operator                                   |
| Production smoke test          | Operator confirmed | Login, TOTP, Session, authorization, CSRF, step-up, Integrations, media, and tombstone checks           |
| Observation window             | Completed          | Operator-confirmed operational completion recorded on 2026-09-11                                        |
| Legacy-secret retirement       | Completed          | Operator directly inspected Vercel and Cloudflare environments; completion recorded on 2026-09-11       |
| Documentation handoff          | Completed          | This closure document, final-cutover runbook, and 2026-09-11 environment-retirement verification record |

## 10. Final rollback statement

Phase 8 requires no database rollback because it added no D1 migration.

Legacy-secret retirement is now complete. Code rollback alone cannot restore Legacy authentication. Any restoration of retired secrets would require the approved secret manager and an explicitly authorized operational process; secrets must never be reconstructed from Git, logs, shell history, or chat.

Fixing forward is preferred while CMS credentials, MFA, Sessions, and D1 remain healthy.
