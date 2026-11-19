// Issue #782: reuse a prior FULL PR E2E only on a verified identical Git tree.
// Every missing/mismatching signal fails closed to running the normal E2E lane.
const SHA = /^[a-f0-9]{40}$/i;
const repoPattern = /^[\w.-]+\/[\w.-]+$/;
const time = (value) => Date.parse(value || "");
function passedJob(jobs, name, head, attempt, mergedAt) {
  const match = jobs.filter((job) => job.name === name);
  return (
    match.length === 1 &&
    match[0].status === "completed" &&
    match[0].conclusion === "success" &&
    match[0].head_sha === head &&
    match[0].run_attempt === attempt &&
    Number.isInteger(match[0].id) &&
    Number.isFinite(time(match[0].completed_at)) &&
    time(match[0].completed_at) <= mergedAt
  );
}

/** Read-only, time-bounded GitHub API reader with no unsafe path interpolation. */
export function makeReader(repo, token, transport = fetch) {
  if (!repoPattern.test(repo || "") || !token) throw new Error("Missing GitHub API access");
  return async (path) => {
    if (!/^\/[a-zA-Z0-9_./?=&-]+$/.test(path)) throw new Error("Unsafe GitHub API path");
    const response = await transport(`https://api.github.com/repos/${repo}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error("GitHub read-only API unavailable: " + response.status);
    return response.json();
  };
}

/**
 * A squash main commit may reuse a PR E2E only when:
 *  - it is associated with exactly one merged main-target PR at the exact prior base;
 *  - the PR head contains that base and the Git tree is IDENTICAL;
 *  - a completed PR CI run for the same immutable head finished before the merge;
 *  - that same run has SUCCESS Change Impact, FULL Functional E2E, and quality.
 * Source/config changes that change CI rules are excluded by the caller's allowlist.
 */
export async function trustedPrE2E({ repo, mainSha, beforeSha, get }) {
  if (!repoPattern.test(repo || "") || !SHA.test(mainSha || "") || !SHA.test(beforeSha || "")) return null;
  if (mainSha === beforeSha || typeof get !== "function") return null;
  try {
    const prs = await get(`/commits/${mainSha}/pulls?per_page=10`);
    if (!Array.isArray(prs) || prs.length !== 1) return null;
    const pr = prs[0];
    const headSha = pr.head?.sha;
    const mergedAt = time(pr.merged_at);
    if (
      pr.merged !== true ||
      pr.merge_commit_sha !== mainSha ||
      pr.base?.ref !== "main" ||
      pr.base?.sha !== beforeSha ||
      !Number.isInteger(pr.number) ||
      pr.number < 1 ||
      !SHA.test(headSha || "") ||
      !Number.isFinite(mergedAt)
    ) return null;
    const main = await get(`/git/commits/${mainSha}`);
    const head = await get(`/git/commits/${headSha}`);
    if (
      main.sha !== mainSha ||
      head.sha !== headSha ||
      !SHA.test(main.tree?.sha || "") ||
      main.tree.sha !== head.tree?.sha ||
      !Array.isArray(main.parents) ||
      main.parents.length !== 1 ||
      main.parents[0].sha !== beforeSha
    ) return null;
    const comparison = await get(`/compare/${beforeSha}...${headSha}`);
    if (
      comparison.status !== "ahead" ||
      comparison.behind_by !== 0 ||
      comparison.merge_base_commit?.sha !== beforeSha
    ) return null;
    const list = await get(`/actions/runs?event=pull_request&head_sha=${headSha}&per_page=30`);
    if (!Array.isArray(list.workflow_runs) || list.workflow_runs.length > 30) return null;
    for (const run of list.workflow_runs) {
      if (
        !Number.isInteger(run.id) ||
        run.id < 1 ||
        run.event !== "pull_request" ||
        run.path !== ".github/workflows/ci.yml" ||
        run.head_sha !== headSha ||
        run.status !== "completed" ||
        run.conclusion !== "success" ||
        !Number.isInteger(run.run_attempt) ||
        run.run_attempt < 1 ||
        !Number.isFinite(time(run.created_at)) ||
        !Number.isFinite(time(run.updated_at)) ||
        time(run.updated_at) > mergedAt
      ) continue;
      const result = await get(`/actions/runs/${run.id}/jobs?per_page=100`);
      if (!Array.isArray(result.jobs) || result.total_count > 100) continue;
      if (!["Change Impact", "Functional E2E", "quality"].every((name) =>
        passedJob(result.jobs, name, headSha, run.run_attempt, mergedAt)
      )) continue;
      return {
        mainSha,
        beforeSha,
        treeSha: main.tree.sha,
        prNumber: pr.number,
        prHeadSha: headSha,
        prRunId: run.id,
        runAttempt: run.run_attempt,
        e2eJobId: result.jobs.find((job) => job.name === "Functional E2E").id,
        qualityJobId: result.jobs.find((job) => job.name === "quality").id
      };
    }
  } catch {
    // API outages or incomplete evidence must never silently bypass tests.
  }
  return null;
}

export async function maybeReuseE2E(plan, { repo, token, get } = {}) {
  if (
    plan?.mode !== "affected" ||
    plan.verifiedPush !== true ||
    plan.verifiedIntegration !== false ||
    !plan.requiredLanes?.includes("functional") ||
    !Array.isArray(plan.changedEntries) ||
    plan.changedEntries.length === 0 ||
    plan.reuseFunctional
  ) return plan;
  const request = get ?? (token ? makeReader(repo, token) : null);
  if (!request) return plan;
  const evidence = await trustedPrE2E({
    repo,
    mainSha: plan.checkoutSha,
    beforeSha: plan.beforeSha,
    get: request
  });
  if (!evidence) return plan;
  return {
    ...plan,
    requiredLanes: plan.requiredLanes.filter((lane) => lane !== "functional"),
    skippedLanes: [...plan.skippedLanes, "functional"],
    reasons: [...plan.reasons, "reused-pr-full-e2e-identical-tree"],
    reuseFunctional: evidence
  };
}
