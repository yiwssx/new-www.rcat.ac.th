import { describe, expect, it } from "vitest";
import { maybeReuseE2E, trustedPrE2E } from "./reuse-functional-e2e.mjs";

const MAIN = "a".repeat(40);
const BASE = "b".repeat(40);
const HEAD = "c".repeat(40);
const TREE = "d".repeat(40);
const MERGED = "2026-11-19T04:22:13Z";
const apiPaths = {
  prs: `/commits/${MAIN}/pulls?per_page=10`,
  main: `/git/commits/${MAIN}`,
  head: `/git/commits/${HEAD}`,
  compare: `/compare/${BASE}...${HEAD}`,
  runs: `/actions/runs?event=pull_request&head_sha=${HEAD}&per_page=30`,
  jobs: "/actions/runs/44457051682/jobs?per_page=100"
};
const all = {
  [apiPaths.prs]: [{
    number: 793,
    state: "closed",
    merged_at: MERGED,
    merge_commit_sha: MAIN,
    base: { sha: BASE, ref: "main" },
    head: { sha: HEAD }
  }],
  [apiPaths.main]: { sha: MAIN, tree: { sha: TREE }, parents: [{ sha: BASE }] },
  [apiPaths.head]: { sha: HEAD, tree: { sha: TREE } },
  [apiPaths.compare]: { status: "ahead", behind_by: 0, merge_base_commit: { sha: BASE } },
  [apiPaths.runs]: {
    workflow_runs: [{
      id: 44457051682,
      event: "pull_request",
      path: ".github/workflows/ci.yml",
      head_sha: HEAD,
      status: "completed",
      conclusion: "success",
      run_attempt: 1,
      created_at: "2026-11-19T04:15:25Z",
      updated_at: "2026-11-19T04:21:52Z"
    }]
  },
  [apiPaths.jobs]: {
    total_count: 3,
    jobs: ["Change Impact", "Functional E2E", "quality"].map((name, index) => ({
      name,
      id: 135334848910 + index,
      head_sha: HEAD,
      status: "completed",
      conclusion: "success",
      run_attempt: 1,
      completed_at: "2026-11-19T04:21:51Z"
    }))
  }
};

const sourcePlan = {
  mode: "affected",
  gateReady: true,
  verifiedPush: true,
  verifiedIntegration: false,
  beforeSha: BASE,
  checkoutSha: MAIN,
  changedEntries: [{ path: "src/public/pages/PublicNewsPage.tsx", status: "modified" }],
  changedPaths: ["src/public/pages/PublicNewsPage.tsx"],
  requiredLanes: ["static-quality", "unit", "build", "functional"],
  skippedLanes: ["dependencies", "integration", "governance", "worker"],
  reasons: ["src/public/pages/PublicNewsPage.tsx:public", "verified-main-scoped-impact-range"]
};
const settings = { repo: "yiwssx/new-www.rcat.ac.th", mainSha: MAIN, beforeSha: BASE };
function reader(override = {}) {
  const data = { ...all, ...override };
  return async (path) => {
    if (!(path in data)) throw new Error("unavailable");
    return data[path];
  };
}

describe("exact-tree Full Functional E2E reuse", () => {
  it("requires the matching squash Git tree and successful prior full E2E + quality", async () => {
    const result = await trustedPrE2E({ ...settings, get: reader() });
    expect(result?.treeSha).toBe(TREE);
    expect(result?.prHeadSha).toBe(HEAD);
    expect(result?.prNumber).toBe(793);
    expect(result?.prRunId).toBe(44457051682);
  });

  it.each([
    { path: apiPaths.prs, value: [] },
    { path: apiPaths.prs, value: [{ ...all[apiPaths.prs][0], base: { sha: HEAD, ref: "main" } }] },
    { path: apiPaths.main, value: { sha: MAIN, tree: { sha: TREE }, parents: [{ sha: HEAD }] } },
    { path: apiPaths.head, value: { sha: HEAD, tree: { sha: "e".repeat(40) } } },
    { path: apiPaths.compare, value: { status: "diverged", behind_by: 1 } },
    { path: apiPaths.runs, value: { workflow_runs: [] } },
    { path: apiPaths.jobs, value: { total_count: 3, jobs: [] } }
  ])("rejects incomplete or unsafe GitHub proof: %j", async (change) => {
    const evidence = await trustedPrE2E({ ...settings, get: reader({ [change.path]: change.value }) });
    expect(evidence).toBeNull();
  });

  it("fails closed on network/API errors", async () => {
    const evidence = await trustedPrE2E({ ...settings, get: async () => { throw Error("offline"); } });
    expect(evidence).toBeNull();
  });

  it("only reuses for an actual scoped source main push that requires Functional E2E", async () => {
    const result = await maybeReuseE2E(sourcePlan, { repo: settings.repo, get: reader() });
    expect(result?.requiredLanes).not.toContain("functional");
    expect(result?.skippedLanes).toContain("functional");
    expect(result?.reuseFunctional?.treeSha).toBe(TREE);
    for (const unsafe of [
      { ...sourcePlan, mode: "full" },
      { ...sourcePlan, verifiedPush: false },
      { ...sourcePlan, requiredLanes: ["static-quality"] }
    ]) {
      expect(await maybeReuseE2E(unsafe, { repo: settings.repo, get: reader() })).toBe(unsafe);
    }
  });

  it("retains the required full E2E when prior job evidence is absent", async () => {
    const result = await maybeReuseE2E(sourcePlan, { repo: settings.repo, get: reader({ [apiPaths.jobs]: { total_count: 0, jobs: [] } }) });
    expect(result).toBe(sourcePlan);
    expect(result.requiredLanes).toContain("functional");
  });
});
