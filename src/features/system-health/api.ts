import { CMS_AUTH_PATHS } from "../cms-auth/constants";
import { fetchCloudflareAdmin } from "../admin-write/cloudflareApi";

export type SystemHealthStatus = "healthy" | "warning" | "error" | "unknown";

export interface SystemHealthCheck {
  id: "frontend" | "cms-auth" | "admin-data" | "public-ssr" | "facebook-bridge";
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

function resolveDependencies(dependencies: SystemHealthDependencies): ProbeContext {
  return {
    fetchImpl: dependencies.fetchImpl ?? fetch,
    fetchAdmin: dependencies.fetchAdmin ?? fetchCloudflareAdmin,
    now: dependencies.now ?? (() => new Date()),
    clock: dependencies.clock ?? (() => performance.now()),
    timeoutMs: dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    browserRuntimeReady:
      dependencies.browserRuntimeReady ??
      (() => typeof window !== "undefined" && typeof document !== "undefined" && Boolean(document.getElementById("root")))
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

export async function runSystemHealthChecks(
  dependencies: SystemHealthDependencies = {}
): Promise<SystemHealthReport> {
  const context = resolveDependencies(dependencies);
  const [cmsAuth, adminData, publicSsr] = await Promise.all([
    runCmsAuthCheck(context),
    runAdminDataCheck(context),
    runPublicSsrCheck(context)
  ]);
  const checks = [
    buildFrontendCheck(context),
    cmsAuth,
    adminData,
    publicSsr,
    buildFacebookBridgeBoundary(context)
  ];

  return {
    overallStatus: getOverallStatus(checks),
    checkedAt: context.now().toISOString(),
    checks
  };
}
