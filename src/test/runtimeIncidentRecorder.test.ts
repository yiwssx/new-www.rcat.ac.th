import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRuntimeIncidentPayload,
  installRuntimeIncidentRecorder,
  sanitizeRuntimeIncidentPathname
} from "../features/runtime-incidents/client";

const ENDPOINT = "https://worker.example.test/api/public/runtime-incident";
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    cleanups.pop()?.();
  }
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("B2 runtime incident recorder", () => {
  it("redacts token-like path segments and removes query strings", () => {
    expect(
      sanitizeRuntimeIncidentPathname(
        "/admin/reset-password/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?token=secret"
      )
    ).toBe("/admin/reset-password/:redacted");
  });

  it("builds an allowlisted payload without raw messages, stacks, or arbitrary request IDs", () => {
    const payload = buildRuntimeIncidentPayload({
      kind: "runtime_error",
      surface: "admin",
      pathname: "/admin/content?draft=secret",
      errorName: "SecretBearingCustomError",
      requestId: "not-a-request-id"
    });

    expect(payload).toEqual({
      kind: "runtime_error",
      surface: "admin",
      pathname: "/admin/content",
      errorName: "OtherError"
    });
    expect(payload).not.toHaveProperty("message");
    expect(payload).not.toHaveProperty("stack");
  });

  it("records an uncaught error once per 60-second browser dedupe window", async () => {
    const reports: unknown[] = [];
    const nativeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ENDPOINT) {
        reports.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }

      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const cleanup = installRuntimeIncidentRecorder({
      enabled: true,
      endpoint: ENDPOINT,
      fetchImpl: nativeFetch,
      now: () => 1_000
    });
    cleanups.push(cleanup);
    window.history.replaceState(
      {},
      "",
      "/admin/reset-password/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?token=never-store"
    );

    const event = new ErrorEvent("error", {
      error: new TypeError("never store this message"),
      message: "never store this message"
    });
    window.dispatchEvent(event);
    window.dispatchEvent(event);

    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]).toEqual({
      kind: "runtime_error",
      surface: "auth",
      pathname: "/admin/reset-password/:redacted",
      errorName: "TypeError"
    });
    expect(JSON.stringify(reports[0])).not.toContain("never store this message");
  });

  it("captures API 5xx responses with only the sanitized API pathname and validated request ID", async () => {
    const reports: unknown[] = [];
    const nativeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === ENDPOINT) {
        reports.push(JSON.parse(String(init?.body ?? "{}")));
        return new Response(JSON.stringify({ accepted: true }), { status: 202 });
      }

      return new Response(JSON.stringify({ error: "private upstream detail" }), {
        status: 503,
        headers: { "X-RCAT-Request-ID": REQUEST_ID }
      });
    }) as typeof fetch;
    const cleanup = installRuntimeIncidentRecorder({
      enabled: true,
      endpoint: ENDPOINT,
      fetchImpl: nativeFetch,
      now: () => 10_000
    });
    cleanups.push(cleanup);
    window.history.replaceState({}, "", "/admin/content");

    const response = await globalThis.fetch("/api/admin-proxy?path=%2Fapi%2Fadmin%2Fcontent%3Fq%3Dsecret", {
      method: "GET"
    });

    expect(response.status).toBe(503);
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]).toEqual({
      kind: "api_failure",
      surface: "admin",
      pathname: "/api/admin-proxy",
      apiMethod: "GET",
      httpStatus: 503,
      requestId: REQUEST_ID
    });
    expect(JSON.stringify(reports[0])).not.toContain("private upstream detail");
    expect(JSON.stringify(reports[0])).not.toContain("q=secret");
  });
});
