import { CMS_AUTH_PATHS } from "../cms-auth/constants";
import { fetchCloudflareAdmin } from "../admin-write/cloudflareApi";

export type SystemHealthStatus = "healthy" | "warning" | "error" | "unknown";

export interface SystemHealthCheck {
  id: "frontend" | "cms-auth" | "admin-data" | "public-ssr" | "health-aggregation" | "facebook-bridge";
  label: string;
  description: string;
  status: SystemHealthStatus;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
  httpStatus?: number;
  requestId?: string;
}

export interface SystemHealthReport {
  overallStatus: Exclude<SystemHealthStatus, "unknown">;
  checkedAt: string;
  checks: SystemHealthCheck[];
}

export interface SystemHealthDependencies {
  fetchImpl?: typeof fetch;
  fetchAdmin?: (path: string, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
  clock?: () => number;
  timeoutMs?: number;
  browserRuntimeReady?: () => boolean;
}

const REQUEST_ID_HEADER = "X-RCAT-Request-ID";
const DEFAULT_TIMEOUT_MS = 8_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGGREGATION_GUARD_LABELS = {
  "phase-a": "Phase A",
  p6a: "P6A",
  p6b: "P6B",
  p6c: "P6C"
} as const;

interface ProbeContext {
  fetchImpl: typeof fetch;
  fetchAdmin: (path: string, init?: RequestInit) => Promise<Response>;
  now: () => Date;
  clock: () => number;
  timeoutMs: number;
  browserRuntimeReady: () => boolean;
}

interface HttpProbeInput {
  id: SystemHealthCheck["id"];
  label: string;
  description: string;
  request: (signal: AbortSignal) => Promise<Response>;
  successDetail: string;
}

interface HealthAggregationGuard {
  id: keyof typeof AGGREGATION_GUARD_LABELS;
  status: SystemHealthStatus;
}

interface HealthAggregationPayload {
  overallStatus: Exclude<SystemHealthStatus, "unknown">;
  deployment: {
    status: SystemHealthStatus;
    state: string;
  };
  guards: HealthAggregationGuard[];
  incidents: {
    windowHours: number;
    occurrenceCount: number;
  };
}

function resolveDependencies(dependencies: SystemHealthDependencies): ProbeContext {
  return {
    fetchImpl: dependencies.fetchImpl ?? fetch,
    fetchAdmin: dependencies.fetchAdmin ?? fetchCloudflareAdmin,
    now: dependencies.now ?? (() => new Date()),
    clock: dependencies.clock ?? (() => performance.now()),
    timeoutMs: dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    browserRuntimeReady:
      dependencies.browserRuntimeReady ??
      (() =>
        typeof window !== "undefined" && typeof document !== "undefined" && Boolean(document.getElementById("root")))
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHealthStatus(value: unknown): value is SystemHealthStatus {
  return value === "healthy" || value === "warning" || value === "error" || value === "unknown";
}

function isOverallHealthStatus(value: unknown): value is Exclude<SystemHealthStatus, "unknown"> {
  return value === "healthy" || value === "warning" || value === "error";
}

function parseHealthAggregationPayload(value: unknown): HealthAggregationPayload | null {
  if (!isRecord(value) || !isOverallHealthStatus(value.overallStatus)) {
    return null;
  }

  const deployment = isRecord(value.deployment) ? value.deployment : null;
  if (!deployment || !isHealthStatus(deployment.status)) {
    return null;
  }

  const guards: HealthAggregationGuard[] = Array.isArray(value.guards)
    ? value.guards.flatMap<HealthAggregationGuard>((candidate) => {
        if (!isRecord(candidate) || !isHealthStatus(candidate.status)) {
          return [];
        }

        const id = candidate.id;
        if (id !== "phase-a" && id !== "p6a" && id !== "p6b" && id !== "p6c") {
          return [];
        }

        return [{ id, status: candidate.status }];
      })
    : [];
  const incidents = isRecord(value.incidents) ? value.incidents : null;
  const windowHours = Number(incidents?.windowHours);
  const occurrenceCount = Number(incidents?.occurrenceCount);

  if (guards.length !== 4 || !Number.isFinite(windowHours) || !Number.isFinite(occurrenceCount)) {
    return null;
  }

  return {
    overallStatus: value.overallStatus,
    deployment: {
      status: deployment.status,
      state: typeof deployment.state === "string" ? deployment.state : "unknown"
    },
    guards,
    incidents: {
      windowHours: Math.max(1, Math.round(windowHours)),
      occurrenceCount: Math.max(0, Math.round(occurrenceCount))
    }
  };
}

function readSafeRequestId(response: Response) {
  const value = response.headers.get(REQUEST_ID_HEADER)?.trim() ?? "";
  return UUID_PATTERN.test(value) ? value : undefined;
}

function classifyHttpStatus(status: number): Exclude<SystemHealthStatus, "unknown"> {
  if (status >= 200 && status < 300) {
    return "healthy";
  }

  if (status >= 500 || status === 401 || status === 403) {
    return "error";
  }

  return "warning";
}

function failureDetail(status: number) {
  if (status === 401) {
    return "เซสชัน CMS ไม่ผ่านการตรวจสอบ";
  }

  if (status === 403) {
    return "เซิร์ฟเวอร์ปฏิเสธสิทธิ์ของคำขอตรวจสุขภาพ";
  }

  if (status >= 500) {
    return "บริการตอบกลับด้วยข้อผิดพลาดจากเซิร์ฟเวอร์";
  }

  return `บริการตอบกลับด้วย HTTP ${status}`;
}

async function runHttpProbe(input: HttpProbeInput, context: ProbeContext): Promise<SystemHealthCheck> {
  const startedAt = context.clock();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), context.timeoutMs);

  try {
    const response = await input.request(controller.signal);
    const status = classifyHttpStatus(response.status);

    return {
      id: input.id,
      label: input.label,
      description: input.description,
      status,
      detail: status === "healthy" ? input.successDetail : failureDetail(response.status),
      checkedAt: context.now().toISOString(),
      latencyMs: Math.max(0, Math.round(context.clock() - startedAt)),
      httpStatus: response.status,
      requestId: readSafeRequestId(response)
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";

    return {
      id: input.id,
      label: input.label,
      description: input.description,
      status: "error",
      detail: timedOut ? "หมดเวลารอการตอบกลับจากบริการ" : "ไม่สามารถติดต่อบริการได้",
      checkedAt: context.now().toISOString(),
      latencyMs: Math.max(0, Math.round(context.clock() - startedAt))
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFrontendCheck(context: ProbeContext): SystemHealthCheck {
  const ready = context.browserRuntimeReady();

  return {
    id: "frontend",
    label: "Frontend runtime",
    description: "ตรวจว่าหน้า Admin ถูกโหลดและมี application root พร้อมทำงาน",
    status: ready ? "healthy" : "error",
    detail: ready ? "Browser runtime พร้อมใช้งาน" : "ไม่พบ application root ของหน้า Admin",
    checkedAt: context.now().toISOString()
  };
}

async function runCmsAuthCheck(context: ProbeContext) {
  return runHttpProbe(
    {
      id: "cms-auth",
      label: "CMS Authentication",
      description: "ตรวจ session endpoint ผ่าน Vercel CMS auth boundary",
      request: (signal) =>
        context.fetchImpl(CMS_AUTH_PATHS.session, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal
        }),
      successDetail: "CMS session endpoint ตอบกลับปกติ"
    },
    context
  );
}

async function runAdminDataCheck(context: ProbeContext) {
  return runHttpProbe(
    {
      id: "admin-data",
      label: "Admin API / Worker / D1",
      description: "ตรวจ read path เดิมจาก Vercel Admin Proxy ไป Cloudflare Worker และ D1",
      request: (signal) =>
        context.fetchAdmin("/api/admin/dashboard-summary", {
          method: "GET",
          cache: "no-store",
          signal
        }),
      successDetail: "Admin read path ถึง Worker/D1 ตอบกลับปกติ"
    },
    context
  );
}

function aggregationStatusLabel(status: SystemHealthStatus) {
  if (status === "healthy") return "ปกติ";
  if (status === "warning") return "เตือน";
  if (status === "error") return "ผิดปกติ";
  return "รอ/ไม่ทราบ";
}

async function runHealthAggregationCheck(context: ProbeContext): Promise<SystemHealthCheck> {
  const startedAt = context.clock();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), context.timeoutMs);

  try {
    const response = await context.fetchImpl("/api/health-aggregation", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const base = {
      id: "health-aggregation" as const,
      label: "Health Aggregation · B3",
      description: "รวม Phase A/P6A/P6B/P6C, Vercel deployment metadata และ B2 incidents ผ่าน server-owned boundary",
      checkedAt: context.now().toISOString(),
      latencyMs: Math.max(0, Math.round(context.clock() - startedAt)),
      httpStatus: response.status,
      requestId: readSafeRequestId(response)
    };

    if (!response.ok) {
      return {
        ...base,
        status: classifyHttpStatus(response.status),
        detail: failureDetail(response.status)
      };
    }

    const payload = parseHealthAggregationPayload(await response.json());
    if (!payload) {
      return {
        ...base,
        status: "warning",
        detail: "Health aggregation ตอบกลับ แต่ payload ไม่ตรง contract ที่คาดไว้"
      };
    }

    const guardSummary = payload.guards
      .map((guard) => `${AGGREGATION_GUARD_LABELS[guard.id]} ${aggregationStatusLabel(guard.status)}`)
      .join(" · ");
    const deploymentSummary = `Vercel ${aggregationStatusLabel(payload.deployment.status)}`;
    const incidentSummary = `B2 ${payload.incidents.occurrenceCount} เหตุการณ์/${payload.incidents.windowHours} ชม.`;

    return {
      ...base,
      status: payload.overallStatus,
      detail: `${guardSummary} · ${deploymentSummary} · ${incidentSummary}`
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";

    return {
      id: "health-aggregation",
      label: "Health Aggregation · B3",
      description: "รวม Phase A/P6A/P6B/P6C, Vercel deployment metadata และ B2 incidents ผ่าน server-owned boundary",
      status: "error",
      detail: timedOut ? "หมดเวลารอ Health Aggregation" : "ไม่สามารถอ่าน Health Aggregation ได้",
      checkedAt: context.now().toISOString(),
      latencyMs: Math.max(0, Math.round(context.clock() - startedAt))
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runPublicSsrCheck(context: ProbeContext): Promise<SystemHealthCheck> {
  const startedAt = context.clock();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), context.timeoutMs);

  try {
    const response = await context.fetchImpl("/", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal: controller.signal
    });
    const latencyMs = Math.max(0, Math.round(context.clock() - startedAt));
    const base = {
      id: "public-ssr" as const,
      label: "Public SSR",
      description: "ตรวจหน้าแรกผ่าน production-style SSR response โดยไม่เขียนข้อมูล",
      checkedAt: context.now().toISOString(),
      latencyMs,
      httpStatus: response.status,
      requestId: readSafeRequestId(response)
    };

    if (!response.ok) {
      return {
        ...base,
        status: classifyHttpStatus(response.status),
        detail: failureDetail(response.status)
      };
    }

    const html = await response.text();
    const hasSsrMarker = html.includes('data-rcat-ssr="true"');

    return {
      ...base,
      status: hasSsrMarker ? "healthy" : "warning",
      detail: hasSsrMarker ? "Public SSR ตอบ HTML พร้อม SSR marker" : "หน้าแรกตอบกลับ แต่ไม่พบ SSR marker ที่คาดไว้"
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";

    return {
      id: "public-ssr",
      label: "Public SSR",
      description: "ตรวจหน้าแรกผ่าน production-style SSR response โดยไม่เขียนข้อมูล",
      status: "error",
      detail: timedOut ? "หมดเวลารอ Public SSR" : "ไม่สามารถติดต่อ Public SSR ได้",
      checkedAt: context.now().toISOString(),
      latencyMs: Math.max(0, Math.round(context.clock() - startedAt))
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFacebookBridgeBoundary(context: ProbeContext): SystemHealthCheck {
  return {
    id: "facebook-bridge",
    label: "Facebook Thumbnail Bridge",
    description: "เส้นทางสร้าง thumbnail มี side effect จึงไม่ยิงจาก health dashboard",
    status: "unknown",
    detail: "ไม่ตรวจอัตโนมัติจนกว่าจะมี read-only health endpoint ที่ไม่สร้างหรือแก้ข้อมูล",
    checkedAt: context.now().toISOString()
  };
}

function getOverallStatus(checks: SystemHealthCheck[]): SystemHealthReport["overallStatus"] {
  if (checks.some((check) => check.status === "error")) {
    return "error";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  return "healthy";
}

export async function runSystemHealthChecks(dependencies: SystemHealthDependencies = {}): Promise<SystemHealthReport> {
  const context = resolveDependencies(dependencies);
  const [cmsAuth, adminData, publicSsr, healthAggregation] = await Promise.all([
    runCmsAuthCheck(context),
    runAdminDataCheck(context),
    runPublicSsrCheck(context),
    runHealthAggregationCheck(context)
  ]);
  const checks = [
    buildFrontendCheck(context),
    cmsAuth,
    adminData,
    publicSsr,
    healthAggregation,
    buildFacebookBridgeBoundary(context)
  ];

  return {
    overallStatus: getOverallStatus(checks),
    checkedAt: context.now().toISOString(),
    checks
  };
}
