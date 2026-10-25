# RCAT automated security preflight

Status: **Manual one-click preflight**. This workflow does not execute a six-phase AI security audit.

## Run

Open [GitHub Actions](https://github.com/yiwssx/new-www.rcat.ac.th/actions), choose
**Security Audit Preflight**, select **Run workflow**, choose branch `main`
and the `quick` or `standard` profile, then click **Run workflow**.

The workflow performs:

1. Main-branch and exact-source-SHA checks; it refuses other branches.
2. A pinned host-side Docker image bootstrap with no target execution.
3. The existing fail-closed, no-network Docker isolation smoke test.
4. Bounded static source-control **presence** checks inside a fresh offline container.
5. A safe GitHub job summary with commit, selected profile, and audit limitation.

`quick` examines four CMS/Admin boundary files; `standard` examines eight.
The checks detect missing known control indicators only. Presence is **not proof**
that a control works, and passing does not prove the application is secure.

No production site is accessed, and neither source-derived vulnerability details
nor unverified exploit paths are published in logs or downloadable artifacts.
No secrets or privileged tokens are passed into the sandbox.

For local validation on a trusted, disposable Linux host, preload the pinned image
as documented in [audit-sandbox.md](audit-sandbox.md), then run:

```sh
bash scripts/security-audit/run-sandbox.sh
bash scripts/security-audit/run-preflight.sh quick
bash scripts/security-audit/run-preflight.sh standard
```

## Security boundaries and current limitations

- The runner uses `--network none`, strict resource limits, read-only source,
  dropped privileges, and scratch-only ephemeral writes.
- Both profiles are static presence checks. They are **not** independent hunters,
  vulnerability reproduction, a clean bill of health, or a vulnerability report.
- No external model provider, API credential, AI agent delegation, or networked model
  inference is installed. AI agent execution must not be simulated by the source
  inventory script.
- The six-phase audit requires isolated hunter/verifier/critic roles, the vendor
  coverage ledger and findings validators, a race-safe parent-owned evidence
  promotion mechanism, and a private report location. These are not implemented
  by this workflow and remain tracked in
  [Issue #713](https://github.com/yiwssx/new-www.rcat.ac.th/issues/713).
- Do not run active tests against Production, D1, live endpoints, or real users.
  Do not upload suspected exploitable findings into a public GitHub Actions artifact.

**Success** means only that the sandbox and selected deterministic checks passed.
It must never be labeled `Full Security Audit Complete`.
