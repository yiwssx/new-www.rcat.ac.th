import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductionReleaseManifest, verifyProductionReleaseManifest } from "./production-release-manifest.mjs";
import { inspectLiveProductionRelease } from "./check-production-release-manifest.mjs";

const SHA = "a".repeat(40);
const env = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "yiwssx",
  VERCEL_GIT_REPO_SLUG: "new-www.rcat.ac.th",
  VERCEL_GIT_COMMIT_REF: "main",
  VERCEL_GIT_COMMIT_SHA: SHA
};
const manifest = createProductionReleaseManifest(env);

test("creates a public release witness only for the exact production Git checkout", () => {
  assert.equal(manifest.sha, SHA);
  assert.equal(manifest.ref, "main");
  assert.equal(createProductionReleaseManifest({ ...env, VERCEL_ENV: "preview" }), null);
  for (const changed of [
    { VERCEL: "0" },
    { VERCEL_GIT_PROVIDER: "gitlab" },
    { VERCEL_GIT_REPO_OWNER: "other" },
    { VERCEL_GIT_REPO_SLUG: "other" },
    { VERCEL_GIT_COMMIT_REF: "feature" },
    { VERCEL_GIT_COMMIT_SHA: "missing" }
  ]) {
    assert.throws(() => createProductionReleaseManifest({ ...env, ...changed }));
  }
});

test("a matching SHA alone is insufficient without the provider, repo, branch and environment", () => {
  assert.equal(verifyProductionReleaseManifest(manifest, SHA), "ready");
  assert.equal(verifyProductionReleaseManifest(manifest, "b".repeat(40)), "pending");
  assert.equal(verifyProductionReleaseManifest(manifest, "invalid"), "failure");
  for (const change of [
    { provider: "github" },
    { repository: "other/repo" },
    { ref: "preview" },
    { environment: "preview" },
    { schemaVersion: 2 }
  ]) {
    assert.equal(verifyProductionReleaseManifest({ ...manifest, ...change }, SHA), "failure");
  }
});

function mockResponse(data, opts = {}) {
  return {
    status: opts.status ?? 200,
    headers: {
      get: (name) =>
        ({ "content-type": opts.type ?? "application/json", "cache-control": opts.cache ?? "no-store" })[name]
    },
    text: async () => (typeof data === "string" ? data : JSON.stringify(data))
  };
}

test("read-only GET probes ONLY canonical TLS origin and validates the live deployed witness", async () => {
  const requests = [];
  const state = await inspectLiveProductionRelease({
    sha: SHA,
    read: async (url, options) => {
      requests.push([url, options]);
      return mockResponse(manifest);
    }
  });
  assert.equal(state, "ready");
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], `https://www.rcat.ac.th/rcat-release.json?sha=${SHA}`);
  assert.equal(requests[0][1].method, "GET");
  assert.equal(requests[0][1].redirect, "error");
  assert.equal(requests[0][1].cache, "no-store");
});

test("stale, absent or untrusted live witnesses cannot pass", async () => {
  const probe = async (response) => inspectLiveProductionRelease({ sha: SHA, read: async () => response });
  assert.equal(await probe(mockResponse({ ...manifest, sha: "b".repeat(40) })), "pending");
  assert.equal(await probe(mockResponse({}, { status: 404 })), "pending");
  assert.equal(await probe(mockResponse(manifest, { type: "text/html" })), "failure");
  assert.equal(await probe(mockResponse(manifest, { cache: "public, max-age=3600" })), "failure");
  assert.equal(await probe(mockResponse({ ...manifest, ref: "preview" })), "failure");
  assert.equal(await probe(mockResponse("not JSON")), "failure");
  assert.equal(await probe(mockResponse("x".repeat(4096))), "failure");
  assert.equal(
    await inspectLiveProductionRelease({ sha: SHA, read: async () => { throw new Error("network"); } }),
    "pending"
  );
  assert.equal(await inspectLiveProductionRelease({ sha: "broken", read: async () => mockResponse(manifest) }), "failure");
});
