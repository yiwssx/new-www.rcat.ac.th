# Security Policy

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately through GitHub's **Security** tab for this repository using **Report a vulnerability** / Private Vulnerability Reporting.

Do **not** disclose vulnerability details in a public GitHub issue, pull request, discussion, commit message, or other public channel.

When reporting, include only the information needed to reproduce and assess the issue, such as:

- the affected route, component, workflow, or service;
- clear reproduction steps;
- the security impact you observed;
- relevant request/response details with credentials and personal data removed;
- a minimal proof of concept when necessary.

Do not include passwords, session tokens, MFA secrets, recovery codes, API tokens, private keys, production database contents, private user data, or other credentials in the report. If sensitive material was exposed during testing, redact it and describe the exposure instead.

## Supported Version

Security fixes are applied to the currently deployed production version and the current `master` branch. Historical releases and archived implementation snapshots are not actively supported.

The current package version is defined by `package.json`; release history is documented in `CHANGELOG.md` and `docs/PROJECT_HISTORY.md`.

## Security Scope

Security reports are relevant when they affect the confidentiality, integrity, or availability of the production platform, including:

- the public Vercel application and SSR/server routes;
- CMS and administrative functionality;
- authentication, sessions, RBAC, MFA, CSRF, step-up authentication, account recovery, and user lifecycle controls;
- Cloudflare Worker APIs and D1-backed data;
- Google Apps Script media/file bridge boundaries;
- deployment, release, rollback, and protected GitHub Actions workflows;
- secret handling, authorization boundaries, or cross-service trust assumptions.

Reports about third-party services or dependencies are useful when they demonstrate a concrete impact on this repository or its production deployment.

## Testing Expectations

Use the minimum access and data necessary to demonstrate a vulnerability.

Do not:

- perform denial-of-service or load testing against production;
- intentionally access, alter, delete, or exfiltrate data belonging to other users;
- attempt social engineering or phishing;
- persist access after demonstrating the issue;
- publish exploit details before maintainers have had an opportunity to assess the report.

If a finding can be demonstrated safely against local or non-production fixtures, prefer that approach.

## Repository Security Boundary

This repository is publicly visible but proprietary. Repository visibility is not a security boundary.

Secrets and production credentials must never be committed to the repository. Existing operational and deployment controls are documented in the repository's current architecture, deployment, security, and recovery documentation.
