#!/usr/bin/env bash
# Ephemeral, fail-closed runner for self-contained audit fixtures only.
set -Eeuo pipefail
umask 077

readonly IMAGE="node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553"
readonly MAX_SECONDS=90
readonly MAX_FILES=64
readonly MAX_SOURCE_BYTES=8388608
readonly MAX_FILE_BYTES=1048576

die() { printf 'audit sandbox: %s\n' "$*" >&2; exit 1; }
command -v docker >/dev/null || die "Docker unavailable; no target code was executed"
command -v timeout >/dev/null || die "timeout unavailable"
command -v node >/dev/null || die "host Node unavailable for policy verification"
command -v git >/dev/null || die "git unavailable"

root="$(git rev-parse --show-toplevel)" || die "not a git checkout"
cd "$root"
ref="$(git rev-parse HEAD)"
entry="scripts/security-audit/sandbox-smoke.cjs"
includes=()
args=()
while (($#)); do
  case "$1" in
    --ref) (($# >= 2)) || die "missing --ref value"; ref="$2"; shift 2 ;;
    --entry) (($# >= 2)) || die "missing --entry value"; entry="$2"; shift 2 ;;
    --include) (($# >= 2)) || die "missing --include value"; includes+=("$2"); shift 2 ;;
    --) shift; args=("$@"); break ;;
    *) die "unknown argument: $1" ;;
  esac
done
[[ "$ref" =~ ^[0-9a-f]{40}$ ]] || die "source ref must be a full commit SHA"
[[ "$(git cat-file -t "$ref" 2>/dev/null)" == commit ]] || die "source ref is not a local commit"

validate_path() {
  local p="$1"
  [[ "$p" =~ ^[A-Za-z0-9_./-]+$ ]] || die "unsafe path"
  [[ "/$p/" != *"/../"* && "/$p/" != *"/./"* && "$p" != /* && "$p" != */ ]] || die "non-canonical path"
  case "$p" in
    scripts/security-audit/*|api/*|server/*|cloudflare/public-api/src/*|cloudflare/public-api/test/*|cloudflare/public-api/migrations/*|src/*) ;;
    *) die "outside explicit, non-secret source allowlist: $p" ;;
  esac
}
validate_path "$entry"
files=("$entry" "${includes[@]}")
(("${#files[@]}" <= MAX_FILES)) || die "too many requested files"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "pinned image absent: bootstrap with docker pull before running (outside target sandbox)"
docker info --format '{{json .SecurityOptions}}' | node -e '
const assert = require("node:assert/strict");
let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{
 const options=JSON.parse(s);assert(Array.isArray(options)&&options.some(x=>x.startsWith("name=seccomp")&&!x.includes("unconfined")),"Docker seccomp must be enabled");
});
' || die "Docker daemon seccomp policy not verified"

stage="$(mktemp -d)" || die "cannot allocate disposable source stage"
name="rcat-audit-${$}-${RANDOM}"
cleanup() {
  docker rm --force "$name" >/dev/null 2>&1 || true
  rm -rf -- "$stage"
}
trap cleanup EXIT
chmod 755 "$stage"
total=0
for file in "${files[@]}"; do
  validate_path "$file"
  line="$(git ls-tree "$ref" -- "$file")"
  [[ -n "$line" ]] || die "missing git-tracked file: $file"
  IFS=$'\t' read -r info found <<< "$line"
  [[ "$found" == "$file" ]] || die "non-exact tree entry"
  read -r mode kind blob <<< "$info"
  [[ "$kind" == blob && ( "$mode" == 100644 || "$mode" == 100755 ) ]] || die "non-regular source entry rejected"
  size="$(git cat-file -s "$blob")"
  ((size <= MAX_FILE_BYTES)) || die "oversized source file"
  total=$((total + size))
  ((total <= MAX_SOURCE_BYTES)) || die "source budget exceeded"
  mkdir -p -- "$stage/${file%/*}"
  git cat-file blob "$blob" > "$stage/$file"
  chmod 444 "$stage/$file"
done
find "$stage" -type d -exec chmod 755 {} +
# No target dependencies, Git metadata, home, environment, Docker socket or host scratch are mounted.
docker create \
  --name "$name" \
  --network none --ipc none --read-only \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 64 --cpus 1 --memory 256m --memory-swap 256m \
  --ulimit nofile=128:128 --ulimit fsize=8388608:8388608 --ulimit core=0:0 \
  --tmpfs /scratch:rw,noexec,nosuid,nodev,size=32m,mode=1777 \
  --mount "type=bind,src=$stage,dst=/target,readonly" \
  --user 65534:65534 --workdir /target --entrypoint /usr/bin/env \
  "$IMAGE" -i HOME=/scratch TMPDIR=/scratch XDG_CACHE_HOME=/scratch PATH=/usr/local/bin:/usr/bin:/bin NODE_ENV=test \
  /usr/local/bin/node "/target/$entry" "${args[@]}" >/dev/null

# Inspect the daemon's actual container policy before launching any target-owned code.
docker inspect --format '{{json .HostConfig}}' "$name" | node -e '
const assert=require("node:assert/strict");
let text="";process.stdin.on("data",x=>text+=x).on("end",()=>{
 const h=JSON.parse(text);
 assert.equal(h.NetworkMode,"none");
 assert.equal(h.ReadonlyRootfs,true);
 assert.equal(h.Privileged,false);
 assert.equal(h.PidsLimit,64);
 assert.equal(h.Memory,268435456);
 assert.equal(h.MemorySwap,268435456);
 assert.equal(h.NanoCpus,1000000000);
 assert(h.CapDrop?.some(x=>x.toLowerCase()==="all"));
 assert(h.SecurityOpt?.some(x=>x==="no-new-privileges"));
 assert.equal(h.Mounts?.length,1);
 assert.equal(h.Mounts[0].Type,"bind");
 assert.equal(h.Mounts[0].Target,"/target");
 assert.equal(h.Mounts[0].ReadOnly,true);
 assert.equal(Object.keys(h.Tmpfs||{}).join(","),"/scratch");
 assert(h.Tmpfs["/scratch"].includes("size=32m"));
 assert.equal(h.IpcMode,"none");
 assert.equal(h.Ulimits?.find(x=>x.Name==="fsize")?.Hard,8388608);
});
' || die "container policy check failed; refused to start"
printf 'audit sandbox: verified container policy; source=%s; files=%s; offline fixture starting\n' "$ref" "${#files[@]}"
timeout --signal=TERM --kill-after=5s "${MAX_SECONDS}s" docker start --attach "$name" || die "sandbox fixture failed or exceeded wall-clock limit"
printf 'audit sandbox: fixture passed; container is disposable (no retained outputs)\n'
