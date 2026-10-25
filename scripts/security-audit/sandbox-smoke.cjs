// Self-contained, non-production isolation smoke test. Never touches a live endpoint.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");

const envKeys = Object.keys(process.env).sort();
assert.deepEqual(envKeys, ["HOME", "NODE_ENV", "PATH", "TMPDIR", "XDG_CACHE_HOME"].sort());
assert.equal(process.getuid(), 65534);
assert.equal(process.env.HOME, "/scratch");
assert.equal(process.env.TMPDIR, "/scratch");

const networks = Object.keys(os.networkInterfaces());
assert.deepEqual(networks, ["lo"], "the container may expose only an isolated loopback interface");
assert.equal(fs.readFileSync("/proc/net/route", "utf8").trim().split("\n").length, 1);

const failWrite = (path) => {
  assert.throws(
    () => fs.writeFileSync(path, "must be denied"),
    (err) => ["EACCES", "EPERM", "EROFS"].includes(err.code),
    `write unexpectedly permitted: ${path}`
  );
};
failWrite("/target/scripts/security-audit/forbidden.tmp");
failWrite("/etc/forbidden.tmp");
failWrite("/tmp/forbidden.tmp");

fs.writeFileSync("/scratch/allowed.tmp", "scratch-only");
assert.equal(fs.readFileSync("/scratch/allowed.tmp", "utf8"), "scratch-only");

const read = (path) => fs.readFileSync(path, "utf8").trim();
const v2 = fs.existsSync("/sys/fs/cgroup/memory.max");
if (v2) {
  assert.equal(read("/sys/fs/cgroup/memory.max"), "268435456");
  assert.equal(read("/sys/fs/cgroup/pids.max"), "64");
  const [quota, period] = read("/sys/fs/cgroup/cpu.max").split(/\s+/).map(Number);
  assert(quota > 0 && period > 0 && quota / period <= 1, "CPU quota missing");
} else {
  assert.equal(read("/sys/fs/cgroup/memory/memory.limit_in_bytes"), "268435456");
  assert.equal(read("/sys/fs/cgroup/pids/pids.max"), "64");
  const quota = Number(read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"));
  const period = Number(read("/sys/fs/cgroup/cpu/cpu.cfs_period_us"));
  assert(quota > 0 && period > 0 && quota / period <= 1, "CPU quota missing");
}

console.log("PASS: offline, scrubbed environment, unprivileged, read-only target, scratch-only writes, enforced cgroups");
