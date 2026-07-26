# CMS Authentication Final Cutover

This runbook governs the Preview and Production rollout of the permanent CMS-only authentication path. It contains no credentials or deployment-specific identifiers.

Phase 8 changes code only. It does not deploy, change a remote environment, migrate D1, revoke a Session, reset MFA, or retire a remote secret.

## Confirmed application prerequisites

The following checks were completed before this coding phase:

- Root CMS password Login works.
- Root MFA enrollment works.
- TOTP Login works.
- Phase 7 smoke testing passed.
- Apps Script media bridge status works.
- Google Drive media storage status works.
- `/admin/integrations` reports the expected connected states.

Before any Production legacy-secret retirement, an operator must also confirm:

- Root Recovery Codes are stored offline in an approved location.
- At least one usable non-Root Admin account exists.
- The secondary Admin password has been tested.
- MFA is configured and tested for that Admin where required.
- A current D1 backup or export exists.
- D1 migrations through `0013` are confirmed.
- Preview and Production Worker and Vercel configuration is recorded in the organization’s approved secret manager.
- The exact previous deployment commit and deployment identifiers are recorded for rollback.

Never record a real identifier, password, token, Recovery Code, cookie, encryption key, D1 ID, or shared secret in this document, an issue, chat, or shell history.

## Final authentication boundary

- The browser uses `/api/cms-auth/*`, `/api/admin-proxy`, and `/api/apps-script-proxy` with secure cookies and `credentials: include`.
- The Vercel Admin Proxy and Apps Script Proxy accept only the CMS Session cookie.
- Vercel forwards only the internal CMS proxy secret, Session token, client metadata, and mutation CSRF token to the Worker.
- The Worker validates the internal proxy secret, metadata-bound D1 Session, active D1 user, role, Session version, capability, CSRF, and step-up assurance.
- The audit actor comes from the validated D1 user and Session.
- Old shared-password, smoke-token, Access-identity, proxy-email, proxy-role, bearer-token, and legacy-cookie mechanisms are inert.
- The retired Login and Logout API paths return no-store JSON `410 Gone`; they never authenticate or clear/create a cookie.
- The one-time Root credential bootstrap HTTP route and capability no longer exist.
- CMS authentication is mandatory. The obsolete feature flag cannot reveal a fallback.
- Existing CMS Sessions remain compatible; Phase 8 has no migration.
- Direct Vercel Function inventory is exactly `admin-proxy`, `apps-script-proxy`, `cms-auth`, and `sitemap`.

## Stage A — Preview

1. Confirm a current Preview D1 backup or export.
2. Confirm migrations through `0013`.
3. Confirm Root access and secondary Admin access.
4. Deploy the Worker to Preview.
5. Deploy Vercel to Preview.
6. Verify the direct Function inventory contains exactly four Functions.
7. Log in normally through `/login` with a designated CMS Admin password and TOTP.
8. Test one Recovery Code and confirm that code is consumed. Login does not issue a replacement set; regeneration is a deliberate action that invalidates the prior remaining set.
9. Test the Admin Dashboard.
10. Test user management within the designated account’s capabilities.
11. Confirm protected mutations require exact CSRF.
12. Confirm a sensitive action produces `428` step-up and succeeds after reauthentication.
13. Test a controlled media upload and delete.
14. Test `/admin/integrations`.
15. Confirm both retired authentication endpoints return JSON `410 Gone`.
16. Confirm an obsolete legacy cookie alone cannot access an Admin API.
17. Observe authentication, proxy, and Worker logs for unexpected `401`, `403`, and `5xx` responses.

Do not remove Preview legacy environment values until Preview acceptance passes. Do not put passwords, TOTP values, or Recovery Codes in command history; use the normal browser Login flow.

## Stage B — Production deployment

1. Record the current Production deployment identifiers and exact commit.
2. Export or back up Production D1.
3. Confirm Root Recovery Codes are available offline.
4. Confirm the secondary Admin can log in.
5. Keep legacy environment values temporarily for rollback; Phase 8 code ignores them.
6. Deploy the Worker first.
7. Smoke-test CMS Login and a safe Admin read.
8. Deploy Vercel.
9. Verify the direct Function inventory contains exactly four Functions.
10. Test Root TOTP Login through `/login`.
11. Test the Dashboard.
12. Test one safe Admin read.
13. Test one controlled mutation with revision protection.
14. Test Integrations.
15. Test the Apps Script media bridge and Google Drive media status.
16. Confirm the retired Login and Logout endpoints return no-store JSON `410 Gone`.
17. Confirm an obsolete legacy cookie does not authenticate.
18. Monitor authentication and `5xx` logs.

Use a designated CMS Admin account and the browser flow. No production credential belongs in a script or command line.

## Stage C — Observation window

Use a deliberate observation window of at least 24 hours unless an approved incident process requires a longer period.

During the window:

- do not remove legacy environment values;
- do not re-enable legacy code;
- monitor password, TOTP, and Recovery Code Login failures;
- monitor Session idle and absolute expiry behavior;
- monitor CSRF failures;
- monitor `428` reauthentication results;
- monitor Admin and Apps Script proxy failures;
- verify secondary Admin access again;
- confirm audit actors continue to match the D1 users that own the validated Sessions.

## Stage D — Secret retirement

Only after Preview and Production acceptance and the observation window, audit and remove verified legacy-only values from the applicable Vercel and Worker environments.

Remove after audit:

- `ADMIN_PROXY_PASSWORD_HASH`;
- `ADMIN_PROXY_SESSION_SECRET`;
- `ADMIN_PROXY_ALLOWED_EMAILS`;
- `ADMIN_RBAC_ADMINS`;
- `ADMIN_RBAC_EDITORS`;
- `ADMIN_RBAC_VIEWERS`;
- `CLOUDFLARE_ADMIN_SMOKE_TOKEN`;
- old Admin smoke-token settings;
- old Admin-specific Access identity settings;
- the obsolete `CMS_AUTH_ENABLED` flag.

Keep:

- `CMS_AUTH_PROXY_SECRET`;
- `CLOUDFLARE_ADMIN_API_URL`;
- `CMS_MFA_ENCRYPTION_KEY`;
- `CMS_MFA_ENCRYPTION_KEY_VERSION`;
- D1 bindings;
- `ADMIN_WRITE_ALLOWED_ORIGINS`;
- the configured Apps Script URL;
- `APPS_SCRIPT_BRIDGE_TOKEN`;
- Google Drive and Apps Script business configuration.

Retire values only through the approved environment-management process. Never copy their values into Git, shell history, chat, or this runbook.

## Stage E — Optional coordinated rotation

`CMS_AUTH_PROXY_SECRET` may be rotated later in a controlled maintenance window:

1. Generate a new cryptographically random secret using the approved secret manager.
2. Schedule a controlled re-login window. Rotating this secret invalidates existing CMS Sessions and outstanding MFA challenges because their metadata hashes use the secret.
3. Coordinate the Worker and Vercel updates to minimize mismatched configuration.
4. Do not commit or print the secret.
5. Require users to log in again after rotation. Existing MFA factors and Recovery Codes are not deleted.
6. Immediately verify password/TOTP Login, an Admin read, a CSRF-protected mutation, and Integrations.
7. Monitor authorization and proxy errors after rotation.

Do not perform this rotation as part of the Phase 8 coding task.

## Stage F — Rollback

Before legacy-secret retirement:

- roll code back to the recorded previous deployment;
- confirm the approved legacy environment values are still available;
- no D1 rollback is needed because Phase 8 has no migration.

After legacy-secret retirement:

- code rollback alone is insufficient;
- restoring legacy behavior would require restoring the retired values from the approved secret manager;
- never reconstruct a secret from Git, shell history, logs, or chat;
- prefer fixing forward when CMS users, credentials, MFA, and Sessions are healthy.

## Recovery and deferred capabilities

- Total Root factor loss requires controlled database intervention under an approved recovery procedure; there is no HTTP bootstrap or emergency bypass.
- Invitations and password-reset tokens are manually delivered through an approved secure channel.
- Automated email delivery is not implemented.
- Passkeys remain deferred.
- Historical obsolete cookies may remain in browsers until their original expiry, but Phase 8 code does not parse, validate, refresh, clear, or authorize from them.
- Historical authentication and audit rows remain intact.
