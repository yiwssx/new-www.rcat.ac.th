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

    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        receivedSignal = init?.signal instanceof AbortSignal ? init.signal : null;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      })
    );

    const request = getPublicJson("/api/public/home", "public-home", { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toSatisfy((error: unknown) => isPublicReadAbortError(error));
    expect(receivedSignal).toBe(controller.signal);
  });

  it("classifies network, HTTP, invalid JSON, and invalid response failures", async () => {
    vi.stubEnv("VITE_CLOUDFLARE_PUBLIC_API_URL", "https://public-api.example.test");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(getPublicJson("/network", "network")).rejects.toMatchObject({
      name: "PublicReadError",
      kind: "network",
      resource: "network"
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "missing" }, { status: 404 }))
    );
    const notFound = await getPublicJson("/missing", "missing").catch((error) => error);
    expect(notFound).toBeInstanceOf(PublicReadError);
    expect(isPublicReadNotFoundError(notFound)).toBe(true);
    expect(notFound).toMatchObject({ kind: "http", status: 404, resource: "missing" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));
    await expect(getPublicJson("/invalid-json", "invalid-json")).rejects.toMatchObject({
      kind: "invalid-json",
      resource: "invalid-json"
    });

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(["unexpected"], { status: 200 })));
    await expect(getPublicJson("/invalid-response", "invalid-response")).rejects.toMatchObject({
      kind: "invalid-response",
      resource: "invalid-response"
    });
  });
});
