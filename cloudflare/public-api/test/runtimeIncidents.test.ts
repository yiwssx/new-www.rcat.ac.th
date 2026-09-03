// @vitest-environment node
import { describe, expect, it } from "vitest";
import { routeRequest } from "../src/router";
import {
  getRuntimeIncidentBucketStart,
  handleAdminRuntimeIncidents,
  parseRuntimeIncidentInput,
  recordRuntimeIncident,
  sanitizeRuntimeIncidentPathname
} from "../src/routes/runtimeIncidents";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function createD1Recorder() {
  const statements: Array<{ query: string; bindings: unknown[] }> = [];

  const db = {
    prepare(query: string) {
      const entry = { query, bindings: [] as unknown[] };
      statements.push(entry);
      const statement = {
        bind(...bindings: unknown[]) {
          entry.bindings = bindings;
          return statement;
        },
        async all<T>() {
          return { results: [] as T[] };
        }
      };
      return statement;
    },
    async batch() {
      return [];
    }
  } as unknown as D1Database;

  return { db, statements };
}

describe("B2 runtime incident storage contract", () => {
  it("sanitizes paths before persistence and never accepts query strings as incident identity", () => {
    expect(
      sanitizeRuntimeIncidentPathname(
        "/admin/reset-password/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?token=do-not-store"
      )
    ).toBe("/admin/reset-password/:redacted");
  });

  it("keeps a finite event allowlist and validates request IDs", () => {
    expect(
      parseRuntimeIncidentInput({
        kind: "runtime_error",
        surface: "admin",
        pathname: "/admin/content?draft=private",
        errorName: "TypeError",
        requestId: REQUEST_ID,
        message: "must be ignored",
        stack: "must be ignored"
      })
    ).toEqual({
      kind: "runtime_error",
      surface: "admin",
      pathname: "/admin/content",
      errorName: "TypeError",
      apiMethod: "",
      httpStatus: null,
      requestId: REQUEST_ID
    });

    expect(
      parseRuntimeIncidentInput({
        kind: "runtime_error",
        surface: "public",
        pathname: "/",
        errorName: "Error",
        requestId: "attacker-controlled"
      })?.requestId
    ).toBe("");
    expect(parseRuntimeIncidentInput({ kind: "console_log", surface: "public", pathname: "/" })).toBeNull();
  });

  it("accepts only API 5xx or network failures", () => {
    expect(
      parseRuntimeIncidentInput({
        kind: "api_failure",
        surface: "admin",
        pathname: "/api/admin-proxy?path=private",
        apiMethod: "GET",
        httpStatus: 503,
        errorName: "arbitrary"
      })
    ).toMatchObject({
      pathname: "/api/admin-proxy",
      apiMethod: "GET",
      httpStatus: 503,
      errorName: "HttpError"
    });
    expect(
      parseRuntimeIncidentInput({
        kind: "api_failure",
        surface: "public",
        pathname: "/api/public/home",
        apiMethod: "GET",
        httpStatus: 404
      })
    ).toBeNull();
    expect(
      parseRuntimeIncidentInput({
        kind: "api_failure",
        surface: "public",
        pathname: "/api/public/home",
        apiMethod: "GET"
      })
    ).toMatchObject({ httpStatus: null, errorName: "NetworkError" });
  });

  it("uses deterministic five-minute aggregation buckets", () => {
    expect(getRuntimeIncidentBucketStart(new Date("2026-09-03T08:14:59.999Z"))).toBe("2026-09-03T08:10:00.000Z");
    expect(getRuntimeIncidentBucketStart(new Date("2026-09-03T08:15:00.000Z"))).toBe("2026-09-03T08:15:00.000Z");
  });

  it("persists only the allowlisted fields and bounds the table to the latest 2000 rows", async () => {
    const { db, statements } = createD1Recorder();
    const response = await recordRuntimeIncident(
      new Request("https://worker.example.test/api/public/runtime-incident", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "runtime_error",
          surface: "public",
          pathname: "/news?token=never-store",
          errorName: "TypeError",
          requestId: REQUEST_ID,
          message: "private message",
          stack: "private stack",
          token: "private token"
        })
      }),
      { DB: db }
    );

    expect(response.status).toBe(202);
    expect(statements).toHaveLength(2);
    expect(statements[0].query).toContain("ON CONFLICT(dedupe_key, bucket_started_at)");
    expect(statements[1].query).toContain("LIMIT -1 OFFSET ?");
    expect(statements[1].bindings).toEqual([2000]);
    const persistedText = JSON.stringify(statements[0].bindings);
    expect(persistedText).not.toContain("private message");
    expect(persistedText).not.toContain("private stack");
    expect(persistedText).not.toContain("private token");
    expect(persistedText).not.toContain("token=never-store");
  });

  it("rejects untrusted browser origins before touching runtime incident storage", async () => {
    const { db, statements } = createD1Recorder();
    const response = await routeRequest(
      new Request("https://worker.example.test/api/public/runtime-incident", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          kind: "runtime_error",
          surface: "public",
          pathname: "/",
          errorName: "Error"
        })
      }),
      {
        DB: db,
        PUBLIC_ANALYTICS_ALLOWED_ORIGINS: "https://www.rcat.ac.th"
      }
    );

    expect(response.status).toBe(403);
    expect(statements).toHaveLength(0);
  });

  it("keeps the incident feed behind the existing CMS server-proxy authentication boundary", async () => {
    const { db, statements } = createD1Recorder();
    const response = await handleAdminRuntimeIncidents(
      new Request("https://worker.example.test/api/admin/runtime-incidents?hours=24&limit=25"),
      {
        DB: db,
        CMS_AUTH_PROXY_SECRET: "test-only-proxy-secret-repeated-000000000000"
      }
    );

    expect(response?.status).toBe(403);
    expect(statements).toHaveLength(0);
  });
});
