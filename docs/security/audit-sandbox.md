# RCAT Security Audit Sandbox

Status: **Implemented; verified by the existing CI Governance smoke gate.**

Tracking: [Issue #713](https://github.com/yiwssx/new-www.rcat.ac.th/issues/713).

This sandbox is a prerequisite for the audit, not a completed six-phase audit.

## Isolation contract

The trusted host stages only allowlisted, tracked regular source files from an exact Git commit.
It never mounts Git metadata, credentials, host home, dependencies, Docker socket, or shared services.

The container has these enforced restrictions:

- Pinned Node 24 Docker image, fetched by the host before target execution.
- External network disabled with `--network none`; only isolated loopback remains.
- A read-only image filesystem and a read-only bind-mounted source tree.
- Only `/scratch` is writable: 32 MiB tmpfs, with `noexec`, `nosuid`, and `nodev`.
- Non-root UID/GID 65534, all capabilities dropped, and no new privileges.
- Docker default seccomp must be enabled; the runner stops if it is missing.
- 1 CPU, 256 MiB memory and swap, 64 processes, and at most 128 open files.
- Output file limit of 8 MiB and total sandbox wall-clock limit of 90 seconds.
- Environment reset with `env -i` and five explicitly allowed safe variables.
- Host inspection verifies Docker's applied policy before a container can start.

The source staging area and the sandbox are disposable. There is no output retention.
The Docker boundary does not defend against every possible container or kernel exploit.
Use trusted disposable hosts only, not a production server.

## Reproduce on an isolated Linux runner

Requirements: Docker Engine with seccomp and cgroup enforcement, Git, Node, and timeout.
Preload the pinned image outside the target sandbox:

```sh
docker pull \
  node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
bash scripts/security-audit/run-sandbox.sh
```

The existing CI Governance lane performs these steps automatically.
The fixture asserts isolated network interfaces, scrubbed environment, unprivileged UID,
read-only target and root filesystem, writable scratch, and actual cgroup limits.
Missing prerequisites or any failed assertion stop execution and fail the gate.

## Scoped local fixtures

Only self-contained local Node fixtures are supported; no dependency installation or downloads.

```sh
bash scripts/security-audit/run-sandbox.sh \
  --ref "$(git rev-parse HEAD)" \
  --entry scripts/security-audit/sandbox-smoke.cjs
```

Use repeated `--include <repo-relative-path>` arguments for additional approved regular blobs.
Staged paths must be within `scripts/security-audit/`, `api/`, `server/`, `src/`,
or the selected Cloudflare Worker source/test/migration directories.
At most 64 files can be staged, each up to 1 MiB, with an 8 MiB combined limit.

The runner does not provide arbitrary npm, pnpm, browser, or integration environments.
Those require a separately reviewed, offline toolchain and isolation validation.

## Separate full-audit requirements

[Issue #713](https://github.com/yiwssx/new-www.rcat.ac.th/issues/713) remains open
until independently assigned hunter and verifier roles complete the six-phase workflow.
Retained evidence requires the skill's trusted parent-side, descriptor-based promotion.
Do not mount or recursively copy agent scratch into any retained artifacts directory.

No live endpoint tests, shared services, production records, deployment, D1 migrations,
production credentials, or active penetration testing are authorized by this sandbox.
