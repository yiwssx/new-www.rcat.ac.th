# Production Environment Retirement Verification — 2026-09-11

Status: completed and operator-verified.

This record captures production environment state that cannot be proven from repository contents alone. It records the operator's direct inspection of the live Vercel and Cloudflare environment configuration on 2026-09-11. No secret values, private URLs, tokens, identifiers, or credentials are recorded here.

This record is the definitive completion evidence for the two environment follow-ups identified below unless a later dated operator verification supersedes it.

## Complaint endpoint configuration

The operator directly inspected the Vercel project environment and confirmed:

- `COMPLAINT_API_URI` is the configured production complaint endpoint variable;
- the retired compatibility variable `VITE_COMPLAINT_API_URI` is not present in the live Vercel environment.

The application source may continue to recognize `VITE_COMPLAINT_API_URI` as a compatibility fallback for an old deployment, but that fallback is not part of the verified current Production environment. Browser code must not consume a `VITE_` complaint endpoint.

## CMS authentication legacy retirement

The operator directly inspected the relevant Vercel and Cloudflare environment configuration and confirmed that the CMS-authentication Legacy-secret retirement and its associated observation follow-up are complete.

The legacy-only identifiers governed by `docs/cms-auth-final-cutover.md` are retired from the applicable live environments and must not be restored as active authentication or authorization mechanisms. Current CMS authentication remains the individual-account, CMS Session, capability, CSRF, MFA, and step-up boundary documented by the current runtime ownership and CMS-auth handoff documents.

This verification closes the two operational follow-ups that were previously left conditional in `docs/cms-auth-project-closure.md`:

- Observation window — completed;
- Legacy-secret retirement — completed.

## Evidence classification

This is operator-attested production evidence, not repository-derived proof. The operator confirmed the state after directly reviewing both Vercel and Cloudflare environment configuration on 2026-09-11.

Historical migration and cutover documents remain valid records of the procedure and earlier state. Where those documents say an operational item remains pending "unless separately recorded", this verification record is that separate completion record.
