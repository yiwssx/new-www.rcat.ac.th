# RCAT security audit: offline Docker sandbox

Status: **IMPLEMENTED IN PR — require exact-head CI smoke verification before claiming runnable**.
Tracks the sandbox prerequisite in [Issue #713](https://github.com/yiwssx/new-www.rcat.ac.th/issues/713). This is **not** a six-phase audit and does not establish independent verifier/hunter agents.

## Architecture and threat model

- The trusted host prepares **only explicitly selected, tracked regular blobs** from an exact 40-digit Git commit. No `.git`, runtime `.env`, `node_modules`, GitHub token, credentials, host home, Vercel credentials, Docker socket, or build cache is mounted.
- The pinned Node 24 Docker image is a toolchain preloaded by the operator **before** starting the sandbox. Pulling that pinned image is a host bootstrap operation, not target-controlled execution. Its multi-platform digest is `sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553`.
- Before starting, the host checks Docker's seccomp availability and inspects the created container's actual policy. The target process receives `env -i` with only five explicitly allowlisted variables.
- Docker isolates the PID/mount/network namespaces (`--network none`, `--ipc none`); no external network, only container-local loopback. The root filesystem and all staged source files are read-only. The **only** writable mount is a 32 MiB `/scratch` tmpfs. The container runs as UID/GID 65534, drops all Linux capabilities, enables `no-new-privileges`, and retains the default enabled seccomp profile.
- Resource ceilings: 1 CPU, 256 MiB RAM and swap ceiling, 64 processes, 8 MiB per output file (ulimit), 32 MiB aggregate tmpfs, a 90-second host-enforced wall-clock timeout (plus forced cleanup), and an FD limit of 128.
- Stage and sandbox are disposable; no outputs are retained. To use audit artifacts, implement the Cloudflare skill's **trusted parent-side descriptor-based promotion procedure** first; do not copy scratch directories or mount retained artifacts inside the container.
- This is a Docker process isolation boundary on the CI runner; it does not establish protection from privileged kernel/container escape exploits. Use only trusted, ephemeral runners; never mount shared resources. `docker pull` and the host policy check must finish before any target-controlled code is executed.

## Verify on a trusted disposable runner

Use a Linux host with Docker Engine (seccomp and cgroup enforcement), Git and Node. The host must allow fetching the pinned public toolchain image **outside** the sandbox. Do not run this on a production server.

```sh
docker pull node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
bash scripts/security-audit/run-sandbox.sh
```

The smoke test checks OS-observed network interfaces and route table, sanitized process environment, effective UID, read-only filesystem, scratch-only writes, and real cgroup CPU/RAM/PID limits. **If Docker, image, seccomp, cgroups, or any check is unavailable, the runner refuses to execute the fixture.** The repo's existing CI Governance lane also runs this test, without a new workflow or production deployment.

## Selected single-fixture execution

When a *self-contained local* Node fixture is separately approved, run it with a pinned commit and only required tracked source blobs:

```sh
bash scripts/security-audit/run-sandbox.sh \
  --ref "$(git rev-parse HEAD)" \
  --entry scripts/security-audit/sandbox-smoke.cjs
```

Additional source blobs can be staged with repeated `--include <repo-relative-path>` flags. Allowed prefixes are `scripts/security-audit/`, `api/`, `server/`, `cloudflare/public-api/src/`, `cloudflare/public-api/test/`, `cloudflare/public-api/migrations/`, and `src/`; regular files only, no untracked content, no symlink, at most 64 files, at most 1 MiB per file and 8 MiB in aggregate. This is intentionally **not** a general npm/pnpm/test runner: no package install, no network fetch and no implicit dependency exposure. Tests requiring a different local toolchain must be adapted to a separately reviewed offline image; do not loosen these controls.

## Remaining Issue #713 prerequisites

The Docker smoke establishes only a **runtime isolation gate**. Independently verify separate hunter/verifier agent assignments, source-level coverage ledger, independent validation, and race-safe output promotion before starting the full six-phase skill workflow. Mark Issue #713 resolved only when all of its acceptance criteria have evidence. No live endpoints, D1 migrations, production secrets, deployments, or user records are permitted.
