## Summary

Describe the change and why it is needed.

## Runtime Impact

Check every applicable surface.

- [ ] Vercel frontend / SSR / server routes
- [ ] Cloudflare Worker
- [ ] Cloudflare D1
- [ ] Google Apps Script
- [ ] Authentication / authorization / session security
- [ ] GitHub Actions / deployment governance
- [ ] Documentation / tests only
- [ ] No runtime impact

## Data and Migrations

- [ ] No D1 schema or data migration
- [ ] D1 migration included and migration ordering verified
- [ ] Production data mutation is required and explicitly documented

If a migration or production data change is involved, describe the forward and rollback/recovery path.

## Dependencies and Toolchain

- [ ] No dependency or toolchain changes
- [ ] Dependency status snapshot is updated and committed
- [ ] Major / zero-major update has explicit manual review
- [ ] Node and pnpm remain within the repository's supported toolchain contract

List dependency/toolchain changes when applicable.

## Security and Configuration

- [ ] No secret, credential, production identifier, or private user data is committed
- [ ] No environment-variable or protected-secret change is required
- [ ] Required environment/configuration changes are documented without exposing secret values
- [ ] Security-sensitive behavior has focused regression coverage

## Verification

List the commands, tests, or production-safe checks performed.

```text
# Example
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm build
```

## Deployment and Rollback

- [ ] No production deployment required
- [ ] Vercel deployment required
- [ ] Worker release required
- [ ] Apps Script release required
- [ ] Rollback/recovery path is documented or unchanged

Describe any required post-merge deployment sequence and the rollback/recovery path.

## Evidence / Notes

Add relevant screenshots, logs, run IDs, issue/PR references, or operational notes. Do not include secrets or sensitive production data.
