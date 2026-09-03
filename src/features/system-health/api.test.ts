import { describe, expect, it, vi } from "vitest";
import { runSystemHealthChecks } from "./api";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function jsonResponse(status = 200, requestId = REQUEST_ID) {
  return new Response(JSON.stringify({ ok: true }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-RCAT-Request-ID": requestId
    }
  });
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html" }
  });
}

function stableClock() {
  let value = 100;
  return () => {
    value += 12;
    return value;
  };
}

describe("runSystemHealthChecks", () => {
  it("reports healthy read paths while leaving side-effect bridge unknown", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/") {
        return htmlResponse('<html data-rcat-ssr="true"><body>RCAT</body></html>');
      }

      return jsonResponse();
    }) as typeof fetch;
    const fetchAdmin = vi.fn(async () => jsonResponse());

    const report = await runSystemHealthChecks({
      fetchImpl,
      fetchAdmin,
      browserRuntimeReady: () => true,
      now: () => new Date("2026-09-03T01:00:00.000Z"),
      clock: stableClock()
    });

    expect(report.overallStatus).toBe("healthy");
    expect(report.checks.map((check) => [check.id, check.status])).toEqual([
      ["frontend", "healthy"],
      ["cms-auth", "healthy"],
      ["admin-data", "healthy"],
      ["public-ssr", "healthy"],
      ["facebook-bridge", "unknown"]
    ]);
    expect(report.checks.find((check) => check.id === "cms-auth")?.requestId).toBe(REQUEST_ID);
    expect(fetchAdmin).toHaveBeenCalledWith(
      "/api/admin/dashboard-summary",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
  });

  it("fails the overall report when the Worker/D1 read path returns a server error", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/") {
        return htmlResponse('<html data-rcat-ssr="true"></html>');
      }

      return jsonResponse();
    }) as typeof fetch;
    const fetchAdmin = vi.fn(async () => jsonResponse(503));

    const report = await runSystemHealthChecks({
      fetchImpl,
      fetchAdmin,
      browserRuntimeReady: () => true,
      clock: stableClock()
    });
    const adminCheck = report.checks.find((check) => check.id === "admin-data");

    expect(report.overallStatus).toBe("error");
    expect(adminCheck).toMatchObject({ status: "error", httpStatus: 503 });
    expect(adminCheck?.detail).toBe("บริการตอบกลับด้วยข้อผิดพลาดจากเซิร์ฟเวอร์");
  });

  it("warns when the public page responds without the SSR marker", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/") {
        return htmlResponse("<html><body>client only</body></html>");
      }

      return jsonResponse();
    }) as typeof fetch;

    const report = await runSystemHealthChecks({
      fetchImpl,
      fetchAdmin: async () => jsonResponse(),
      browserRuntimeReady: () => true,
      clock: stableClock()
    });

    expect(report.overallStatus).toBe("warning");
    expect(report.checks.find((check) => check.id === "public-ssr")).toMatchObject({
      status: "warning",
      detail: "หน้าแรกตอบกลับ แต่ไม่พบ SSR marker ที่คาดไว้"
    });
  });

  it("does not expose an untrusted request-id header", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/") {
        return htmlResponse('<html data-rcat-ssr="true"></html>');
      }

      return jsonResponse(200, "not-a-safe-request-id<script>");
    }) as typeof fetch;

    const report = await runSystemHealthChecks({
      fetchImpl,
      fetchAdmin: async () => jsonResponse(200, "also-not-safe"),
      browserRuntimeReady: () => true,
      clock: stableClock()
    });

    expect(report.checks.find((check) => check.id === "cms-auth")?.requestId).toBeUndefined();
    expect(report.checks.find((check) => check.id === "admin-data")?.requestId).toBeUndefined();
  });
});
