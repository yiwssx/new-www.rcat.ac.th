import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicReadAbortError, isPublicReadNotFoundError, PublicReadError } from "./errors";
import { getPublicJson } from "./request";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public read request taxonomy", () => {
  it("passes AbortSignal to fetch and classifies cancellation", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");
    const controller = new AbortController();
    let receivedSignal: AbortSignal | null = null;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal instanceof AbortSignal ? init.signal : null;

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
    expect(receivedSignal).toBe(controller.signal);
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
