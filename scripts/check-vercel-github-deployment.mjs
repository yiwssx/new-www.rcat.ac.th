// GitHub Vercel Deployment Status fallback for a stale "Vercel" commit status.
// Only an exact-SHA, trusted Vercel production success satisfies this gate.
import { pathToFileURL } from "node:url";

const shaPattern = /^[0-9a-f]{40}$/;
const productionPattern = /^production(?:\s*[-–]\s*.+)?$/i;
const isVercel = (d) => d?.app?.slug === "vercel" || /^vercel(?:\[bot\])?$/i.test(d?.creator?.login || "");
const validHttps = (url) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

export function classifyDeployment(deployments, statuses, sha, expectedIgnored) {
  if (!shaPattern.test(sha) || !Array.isArray(deployments)) return "failure";
  const matching = deployments.filter(
    (d) => d?.sha === sha && productionPattern.test(d.environment || "") && isVercel(d)
  );
  if (matching.length === 0) return "pending";
  for (const deployment of matching) {
    const latest = statuses[String(deployment.id)]?.[0];
    if (!latest) continue;
    if (latest.state === "success") {
      return validHttps(latest.environment_url || latest.target_url) ? "ready" : "failure";
    }
    if (latest.state === "inactive") {
      return expectedIgnored && /ignored|skipped|not affected/i.test(latest.description || "") ? "ignored" : "failure";
    }
    if (["error", "failure"].includes(latest.state)) return "failure";
  }
  return "pending";
}

export async function inspectDeployment({ repo, sha, token, expectedIgnored, readJson }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "") || !shaPattern.test(sha) || !token) {
    throw new Error("Missing trusted repository, commit SHA or read-only token");
  }
  const prefix = `https://api.github.com/repos/${repo}`;
  const deployments = await readJson(`${prefix}/deployments?sha=${sha}&per_page=100`, token);
  if (!Array.isArray(deployments)) throw new Error("Malformed deployments response");
  const matching = deployments.filter(
    (d) => d?.sha === sha && productionPattern.test(d.environment || "") && isVercel(d)
  );
  const statuses = {};
  for (const deployment of matching) {
    if (!Number.isSafeInteger(deployment.id) || deployment.id <= 0) continue;
    const rows = await readJson(`${prefix}/deployments/${deployment.id}/statuses?per_page=5`, token);
    if (!Array.isArray(rows)) throw new Error("Malformed deployment statuses response");
    statuses[String(deployment.id)] = rows;
  }
  return classifyDeployment(deployments, statuses, sha, expectedIgnored);
}

async function readJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`GitHub read failed: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const state = await inspectDeployment({
    repo: process.env.GITHUB_REPOSITORY,
    sha: process.env.TARGET_SHA,
    token: process.env.GH_TOKEN,
    expectedIgnored: process.env.EXPECTED_IGNORED === "true",
    readJson
  });
  if (state === "ready") console.log("Matching Vercel GitHub Deployment is successful.");
  if (state === "ignored") console.log("Matching Vercel GitHub Deployment confirms expected ignored build.");
  if (state === "failure") console.error("Matching production deployment failed or violated readiness contract.");
  process.exitCode = { ready: 0, ignored: 10, pending: 11, failure: 1 }[state] ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`GitHub Deployment status fallback failed closed: ${error.message}`);
    process.exitCode = 1;
  });
}
