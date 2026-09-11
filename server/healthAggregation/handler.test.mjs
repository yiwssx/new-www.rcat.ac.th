// @vitest-environment node

import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { getCmsSessionCookieName } from "../cmsAuth/cookies.mjs";
import {
  CMS_AUTH_PROXY_SECRET_HEADER,
  CMS_CLIENT_IP_HEADER,
  CMS_SESSION_TOKEN_HEADER,
  CMS_USER_AGENT_HEADER
} from "../cmsAuth/handlers.mjs";
import { handleHealthAggregationRequest } from "./handler.mjs";

const CMS_SESSION_TOKEN = "A".repeat(43);
const CMS_PROXY_SECRET = "C".repeat(40);
const CMS_WORKER_ORIGIN = "https://worker.example.test";
const MASTER_SHA = "a".repeat(40);

function createRequest({
  cookie = `${getCmsSessionCookieName()}=${CMS_SESSION_TOKEN}`,
  headers = {},
  method = "GET"
} = {}) {
  const request = Readable.from([]);
  request.method = method;
  request.url = "/api/health-aggregation";
  request.headers = {
    host: "www.rcat.ac.th",
    "user-agent": "b3-test-agent",
    "x-forwarded-for": "203.0.113.20",
    "x-forwarded-proto": "https",
    ...(cookie ? { cookie } : {}),
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
  };
  return request;
}

function createResponse() {
  const headers = new Map();
  let body = "";

  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    end(value) {
      body = value === undefined ? "" : String(value);
    },
    get bodyText() {
      return body;
    },
    get bodyJson() {
      return body ? JSON.parse(body) : null;
    }
  };
}

function createEnv() {
  return {
    CLOUDFLARE_ADMIN_API_URL: CMS_WORKER_ORIGIN,
    CMS_AUTH_PROXY_SECRET: CMS_PROXY_SECRET
  };
}

function workflowRun(path, { conclusion = "success", id, number, status = "completed" } = {}) {
  return {
    id: id ?? number ?? 1,
    run_number: number ?? id ?? 1,
    status,
    conclusion: status === "completed" ? conclusion : null,
    head_sha: MASTER_SHA,
    path,
    updated_at: "2026-09-11T01:00:00.000Z"
  };
}

function workflowPayload(overrides = {}) {
  return {
    workflow_runs: [
      workflowRun(".github/workflows/phase-a-production-browser-smoke.yml", {
        id: 101,
        number: 165,
        ...overrides.phaseA
      }),
      workflowRun(".github/workflows/production-observability.yml", {
        id: 102,
        number: 67,
        status: "waiting",
        ...overrides.p6a
      }),
      workflowRun(".github/workflows/p6b-production-security.yml", { id: 103, number: 57, ...overrides.p6b }),
      workflowRun(".github/workflows/p6c-production-reliability.yml", { id: 104, number: 57, ...overrides.p6c })
    ]
  };
}

function deploymentPayload({ description = "Production deployment completed", state = "success" } = {}) {
  return {
    sha: MASTER_SHA,
    statuses: [
      {
        context: "Vercel",
        state,
        description,
        updated_at: "2026-09-11T01:00:00.000Z"
      }
    ]
  };
}

function incidentPayload(items = []) {
  return {
    generatedAt: "2026-09-11T01:00:00.000Z",
    windowHours: 24,
    items
  };
}

async function callHandler(fetchImpl, request = createRequest()) {
  const response = createResponse();
  await handleHealthAggregationRequest(request, response, {
    env: createEnv(),
    fetchImpl,
    now: () => new Date("2026-09-11T01:30:00.000Z"),
    createRequestId: () => "123e4567-e89b-42d3-a456-426614174000"
  });
  return response;
}

describe("B3 health aggregation", () => {
  it("aggregates authenticated operational signals without exposing server credentials", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const value = String(url);
      if (value.startsWith(`${CMS_WORKER_ORIGIN}/api/admin/runtime-incidents`)) {
        return Response.json(incidentPayload());
      }
      if (value.includes("/actions/runs?")) {
        return Response.json(workflowPayload());
      }
      if (value.endsWith("/commits/master/status")) {
        return Response.json(deploymentPayload());
      }
      throw new Error(`unexpected URL ${value}`);
    });

    const response = await callHandler(fetchImpl);

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("Cache-Control")).toBe("no-store");
    expect(response.bodyJson).toMatchObject({
      repository: "yiwssx/new-www.rcat.ac.th",
      branch: "master",
      overallStatus: "healthy",
      sources: { github: "available", incidents: "available" },
      deployment: { status: "healthy", state: "success" },
      incidents: { windowHours: 24, groupCount: 0, occurrenceCount: 0, truncated: false }
    });
    expect(response.bodyJson.guards.map((guard) => [guard.id, guard.status])).toEqual([
      ["phase-a", "healthy"],
      ["p6a", "unknown"],
      ["p6b", "healthy"],
      ["p6c", "healthy"]
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const [, workerInit] = fetchImpl.mock.calls[0];
    expect(workerInit.headers.get(CMS_AUTH_PROXY_SECRET_HEADER)).toBe(CMS_PROXY_SECRET);
    expect(workerInit.headers.get(CMS_SESSION_TOKEN_HEADER)).toBe(CMS_SESSION_TOKEN);
    expect(workerInit.headers.get(CMS_CLIENT_IP_HEADER)).toBe("203.0.113.20");
    expect(workerInit.headers.get(CMS_USER_AGENT_HEADER)).toBe("b3-test-agent");
    expect(response.bodyText).not.toContain(CMS_PROXY_SECRET);
    expect(response.bodyText).not.toContain(CMS_SESSION_TOKEN);
    expect(response.bodyText).not.toContain(CMS_WORKER_ORIGIN);
  });

  it("makes a failed operational guard authoritative over lower-severity incident signals", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const value = String(url);
      if (value.startsWith(`${CMS_WORKER_ORIGIN}/api/admin/runtime-incidents`)) {
        return Response.json(
          incidentPayload([
            {
              id: "incident-1",
              occurrenceCount: 3,
              lastSeenAt: "2026-09-11T01:20:00.000Z"
            }
          ])
        );
      }
      if (value.includes("/actions/runs?")) {
        return Response.json(workflowPayload({ p6c: { conclusion: "failure" } }));
      }
      return Response.json(deploymentPayload());
    });

    const response = await callHandler(fetchImpl);

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.overallStatus).toBe("error");
    expect(response.bodyJson.incidents).toMatchObject({ groupCount: 1, occurrenceCount: 3 });
    expect(response.bodyJson.guards.find((guard) => guard.id === "p6c")?.status).toBe("error");
  });

  it("treats an Ignored Build Step as no new deployment rather than a false deployment success", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const value = String(url);
      if (value.startsWith(`${CMS_WORKER_ORIGIN}/api/admin/runtime-incidents`)) {
        return Response.json(incidentPayload());
      }
      if (value.includes("/actions/runs?")) {
        return Response.json(workflowPayload());
      }
      return Response.json(deploymentPayload({ description: "Canceled by Ignored Build Step", state: "success" }));
    });

    const response = await callHandler(fetchImpl);

    expect(response.statusCode).toBe(200);
    expect(response.bodyJson.deployment).toMatchObject({ status: "unknown", state: "ignored" });
    expect(response.bodyJson.overallStatus).toBe("healthy");
  });

  it("requires a CMS session before any Worker or GitHub metadata request", async () => {
    const fetchImpl = vi.fn();
    const response = await callHandler(fetchImpl, createRequest({ cookie: "" }));

    expect(response.statusCode).toBe(401);
    expect(response.bodyJson).toEqual({ error: "CMS session is invalid or expired" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves dashboard.read enforcement from the existing B2 Worker boundary", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: "forbidden" }, { status: 403 }));
    const response = await callHandler(fetchImpl);

    expect(response.statusCode).toBe(403);
    expect(response.bodyJson).toEqual({ error: "health aggregation access is forbidden" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
