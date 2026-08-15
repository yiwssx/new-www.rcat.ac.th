import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicReadAbortError, isPublicReadNotFoundError, isPublicReadTimeoutError, PublicReadError } from "./errors";
import { getPublicJson, PUBLIC_READ_DEFAULT_TIMEOUT_MS } from "./request";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public read request taxonomy", () => {
  it("propagates caller cancellation through the bounded request signal", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const controller = new AbortController();
    const receivedSignals: AbortSignal[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) receivedSignals.push(init.signal);

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = getPublicJson("/api/public/home", "public-home", { signal: controller.signal });
    controller.abort();
    const error = await request.catch((caught) => caught);

    expect(isPublicReadAbortError(error)).toBe(true);
    expect(receivedSignals).toHaveLength(1);
    expect(receivedSignals[0]).not.toBe(controller.signal);
    expect(receivedSignals[0]?.aborted).toBe(true);
  });

  it("aborts slow upstream requests at the configured deadline", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = getPublicJson("/api/public/home", "public-home", { timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    const error = await request.catch((caught) => caught);

    expect(isPublicReadTimeoutError(error)).toBe(true);
    expect(error).toMatchObject({
      kind: "timeout",
      resource: "public-home",
      message: "Cloudflare public-home request timed out after 25ms"
    });
  });

  it("keeps the deadline active while the response body is being parsed", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;

      return {
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
          })
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = getPublicJson("/api/public/home", "public-home", { timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    const error = await request.catch((caught) => caught);

    expect(isPublicReadTimeoutError(error)).toBe(true);
    expect(error).toMatchObject({ kind: "timeout", resource: "public-home" });
  });

  it("uses a four-second default deadline for public reads", () => {
    expect(PUBLIC_READ_DEFAULT_TIMEOUT_MS).toBe(4_000);
  });

  it("classifies network, HTTP, invalid JSON, and invalid response failures", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");

    const networkFetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", networkFetch);
    await expect(getPublicJson("/network", "network")).rejects.toMatchObject({
      name: "PublicReadError",
      kind: "network",
      resource: "network"
    });

    const notFoundFetch = vi.fn(async () => Response.json({ error: "missing" }, { status: 404 }));
    vi.stubGlobal("fetch", notFoundFetch);
    const notFound = await getPublicJson("/missing", "missing").catch((caught) => caught);
    expect(notFound).toBeInstanceOf(PublicReadError);
    expect(isPublicReadNotFoundError(notFound)).toBe(true);
    expect(notFound).toMatchObject({
      message: "missing",
      kind: "http",
      status: 404,
      resource: "missing",
      backendMessage: "missing"
    });

    const genericHttp = await getPublicJson("/missing", "missing", { httpErrorMessage: "generic" }).catch(
      (caught) => caught
    );
    expect(genericHttp).toMatchObject({
      message: "Cloudflare missing request failed with HTTP 404",
      kind: "http",
      status: 404,
      resource: "missing",
      backendMessage: "missing"
    });

    const invalidJsonFetch = vi.fn(async () => new Response("not-json", { status: 200 }));
    vi.stubGlobal("fetch", invalidJsonFetch);
    await expect(getPublicJson("/invalid-json", "invalid-json")).rejects.toMatchObject({
      kind: "invalid-json",
      resource: "invalid-json"
    });

    const invalidResponseFetch = vi.fn(async () => Response.json(["unexpected"], { status: 200 }));
    vi.stubGlobal("fetch", invalidResponseFetch);
    await expect(getPublicJson("/invalid-response", "invalid-response")).rejects.toMatchObject({
      kind: "invalid-response",
      resource: "invalid-response"
    });
  });
});
