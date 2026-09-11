import process from "node:process";
import { readCmsSessionCookie } from "../cmsAuth/cookies.mjs";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER,
  getCmsClientMetadata,
  getCmsRequestOriginStatus,
  getRequestHeader,
  readCmsAuthConfiguration
} from "../cmsAuth/handlers.mjs";
import {
  ensureNodeRequestId,
  getNodeRequestId,
  RCAT_REQUEST_ID_HEADER
} from "../observability/requestId.mjs";

const REPOSITORY = "yiwssx/new-www.rcat.ac.th";
const BRANCH = "master";
const GITHUB_API_ROOT = `https://api.github.com/repos/${REPOSITORY}`;
const GITHUB_TIMEOUT_MS = 5_000;
const INCIDENT_WINDOW_HOURS = 24;
const INCIDENT_LIMIT = 50;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

const WORKFLOWS = [
  {
    id: "phase-a",
    label: "Phase A Production Browser Smoke",
    path: ".github/workflows/phase-a-production-browser-smoke.yml"
  },
  {
    id: "p6a",
    label: "P6A Production Observability",
    path: ".github/workflows/production-observability.yml",
    waitingIsExpected: true
  },
  {
    id: "p6b",
    label: "P6B Production Security",
    path: ".github/workflows/p6b-production-security.yml"
  },
  {
    id: "p6c",
    label: "P6C Production Reliability",
    path: ".github/workflows/p6c-production-reliability.yml"
  }
];

function runtimeEnv() {
  return process.env;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, status) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeInteger(value) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function safeIsoDate(value) {
  const candidate = safeString(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) {
    return undefined;
  }

  return new Date(candidate).toISOString();
}

function safeSha(value) {
  const candidate = safeString(value);
  return SHA_PATTERN.test(candidate) ? candidate.toLowerCase() : undefined;
}

function createWorkerHeaders(request, configuration, sessionToken) {
  const metadata = getCmsClientMetadata(request);
  const headers = new Headers({
    Accept: "application/json",
    [CMS_AUTH_PROXY_SECRET_HEADER]: configuration.proxySecret,
    [CMS_SESSION_TOKEN_HEADER]: sessionToken,
    [CMS_CLIENT_IP_HEADER]: metadata.clientIp,
    [CMS_USER_AGENT_HEADER]: metadata.userAgent
  });
  const requestId = getNodeRequestId(request);

  if (requestId) {
    headers.set(RCAT_REQUEST_ID_HEADER, requestId);
  }

  return headers;
}

async function readAuthorizedIncidentSummary(request, configuration, fetchImpl) {
  const cookieHeader = getRequestHeader(request, "cookie");
  const sessionToken = readCmsSessionCookie(cookieHeader);

  if (!sessionToken) {
    return {
      error: { status: 401, message: "CMS session is invalid or expired" }
    };
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(
      `${configuration.workerOrigin}/api/admin/runtime-incidents?hours=${INCIDENT_WINDOW_HOURS}&limit=${INCIDENT_LIMIT}`,
      {
        method: "GET",
        headers: createWorkerHeaders(request, configuration, sessionToken),
        redirect: "error"
      }
    );
  } catch {
    return {
      error: { status: 502, message: "health aggregation upstream request failed" }
    };
  }

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 401) {
      return {
        error: { status: 401, message: "CMS session is invalid or expired" }
      };
    }

    if (upstreamResponse.status === 403) {
      return {
        error: { status: 403, message: "health aggregation access is forbidden" }
      };
    }

    if (upstreamResponse.status === 429) {
      return {
        error: { status: 429, message: "too many admin requests" }
      };
    }

    return {
      error: { status: 502, message: "health aggregation upstream is unavailable" }
    };
  }

  let payload;
  try {
    payload = await upstreamResponse.json();
  } catch {
    return {
      error: { status: 502, message: "health aggregation upstream response is invalid" }
    };
  }

  const items = payload && typeof payload === "object" && Array.isArray(payload.items) ? payload.items : null;
  if (!items) {
    return {
      error: { status: 502, message: "health aggregation upstream response is invalid" }
    };
  }

  let occurrenceCount = 0;
  let lastSeenAt;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const count = Number(item.occurrenceCount);
    if (Number.isFinite(count) && count > 0) {
      occurrenceCount += Math.round(count);
    }
    const candidate = safeIsoDate(item.lastSeenAt);
    if (candidate && (!lastSeenAt || candidate > lastSeenAt)) {
      lastSeenAt = candidate;
    }
  }

  return {
    value: {
      status: "available",
      windowHours: INCIDENT_WINDOW_HOURS,
      groupCount: items.length,
      occurrenceCount,
      lastSeenAt,
      truncated: items.length >= INCIDENT_LIMIT
    }
  };
}

async function fetchGitHubJson(fetchImpl, path) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${GITHUB_API_ROOT}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "rcat-b3-health-aggregation"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function readWorkflowRuns(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.workflow_runs)) {
    return [];
  }

  return payload.workflow_runs.filter((run) => run && typeof run === "object");
}

function classifyWorkflowRun(run, waitingIsExpected = false) {
  if (!run) {
    return "unknown";
  }

  const workflowStatus = safeString(run.status).toLowerCase();
  const conclusion = safeString(run.conclusion).toLowerCase();

  if (workflowStatus !== "completed") {
    if (waitingIsExpected && ["waiting", "queued", "pending", "requested"].includes(workflowStatus)) {
      return "unknown";
    }

    return workflowStatus ? "warning" : "unknown";
  }

  if (conclusion === "success") return "healthy";
  if (["failure", "timed_out", "action_required", "stale"].includes(conclusion)) return "error";
  if (["cancelled", "neutral", "skipped"].includes(conclusion)) return "warning";
  return "unknown";
}

function mapWorkflowSignal(config, runs) {
  const run = runs.find((candidate) => safeString(candidate.path) === config.path);
  const runId = safeInteger(run?.id);

  return {
    id: config.id,
    label: config.label,
    status: classifyWorkflowRun(run, config.waitingIsExpected),
    workflowStatus: safeString(run?.status) || "unknown",
    conclusion: safeString(run?.conclusion) || null,
    runId,
    runNumber: safeInteger(run?.run_number),
    headSha: safeSha(run?.head_sha),
    updatedAt: safeIsoDate(run?.updated_at),
    url: runId ? `https://github.com/${REPOSITORY}/actions/runs/${runId}` : undefined
  };
}

function mapDeploymentSignal(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      status: "unknown",
      state: "missing",
      detail: "GitHub commit-status metadata is unavailable"
    };
  }

  const statuses = Array.isArray(payload.statuses)
    ? payload.statuses.filter((status) => status && typeof status === "object")
    : [];
  const vercel = statuses.find((status) => safeString(status.context) === "Vercel");
  const sha = safeSha(payload.sha);

  if (!vercel) {
    return {
      status: "unknown",
      state: "missing",
      detail: "Vercel commit status is not present for master",
      sha
    };
  }

  const description = safeString(vercel.description);
  const ignored = /ignored build step/iu.test(description);
  const state = safeString(vercel.state).toLowerCase();
  const updatedAt = safeIsoDate(vercel.updated_at);

  if (ignored) {
    return {
      status: "unknown",
      state: "ignored",
      detail: "Latest master change did not require a new Vercel deployment",
      sha,
      updatedAt
    };
  }

  if (state === "success") {
    return {
      status: "healthy",
      state: "success",
      detail: "Vercel reports the latest master deployment status as successful",
      sha,
      updatedAt
    };
  }

  if (state === "pending") {
    return {
      status: "warning",
      state: "pending",
      detail: "Vercel deployment status is pending",
      sha,
      updatedAt
    };
  }

  if (state === "failure" || state === "error") {
    return {
      status: "error",
      state,
      detail: "Vercel reports a failed deployment status",
      sha,
      updatedAt
    };
  }

  return {
    status: "unknown",
    state: state || "unknown",
    detail: "Vercel deployment status is not recognized",
    sha,
    updatedAt
  };
}

function getOverallStatus(guards, deployment, incidents, githubAvailable) {
  if (deployment.status === "error" || guards.some((guard) => guard.status === "error")) {
    return "error";
  }

  const unknownRequiredGuard = guards.some((guard) => guard.id !== "p6a" && guard.status === "unknown");
  const unresolvedDeployment = deployment.status === "unknown" && deployment.state !== "ignored";

  if (
    deployment.status === "warning" ||
    unresolvedDeployment ||
    guards.some((guard) => guard.status === "warning") ||
    unknownRequiredGuard ||
    incidents.occurrenceCount > 0 ||
    incidents.truncated ||
    !githubAvailable
  ) {
    return "warning";
  }

  return "healthy";
}

export async function collectHealthAggregation(request, options = {}) {
  const env = options.env ?? runtimeEnv();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now?.() ?? new Date();
  const configuration = readCmsAuthConfiguration(env);

  if (!configuration || typeof fetchImpl !== "function") {
    return {
      error: { status: 503, message: "health aggregation is unavailable" }
    };
  }

  const incidentsResult = await readAuthorizedIncidentSummary(request, configuration, fetchImpl);
  if (incidentsResult.error) {
    return incidentsResult;
  }

  const [workflowPayload, deploymentPayload] = await Promise.all([
    fetchGitHubJson(fetchImpl, `/actions/runs?branch=${encodeURIComponent(BRANCH)}&per_page=100`),
    fetchGitHubJson(fetchImpl, `/commits/${encodeURIComponent(BRANCH)}/status`)
  ]);
  const runs = readWorkflowRuns(workflowPayload);
  const guards = WORKFLOWS.map((config) => mapWorkflowSignal(config, runs));
  const deployment = mapDeploymentSignal(deploymentPayload);
  const githubAvailable = workflowPayload !== null && deploymentPayload !== null;
  const incidents = incidentsResult.value;

  return {
    value: {
      generatedAt: now.toISOString(),
      repository: REPOSITORY,
      branch: BRANCH,
      overallStatus: getOverallStatus(guards, deployment, incidents, githubAvailable),
      sources: {
        github: githubAvailable ? "available" : "degraded",
        incidents: "available"
      },
      deployment,
      guards,
      incidents
    }
  };
}

export async function handleHealthAggregationRequest(request, response, options = {}) {
  ensureNodeRequestId(request, response, { createId: options.createRequestId });
  const method = String(request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    sendEmpty(response, 204);
    return;
  }

  if (method !== "GET") {
    response.setHeader("Allow", "GET, OPTIONS");
    sendJson(response, 405, { error: "method not allowed" });
    return;
  }

  if (getCmsRequestOriginStatus(request) === "blocked") {
    sendJson(response, 403, { error: "health aggregation origin is not allowed" });
    return;
  }

  const result = await collectHealthAggregation(request, options);
  if (result.error) {
    sendJson(response, result.error.status, { error: result.error.message });
    return;
  }

  sendJson(response, 200, result.value);
}
