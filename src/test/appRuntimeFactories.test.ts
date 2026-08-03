import { describe, expect, it } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { createAppQueryClient } from "../queryClient";
import { createAppRuntime } from "../runtime";

describe("application runtime factories", () => {
  it("creates an isolated QueryClient for each runtime", () => {
    const first = createAppQueryClient();
    const second = createAppQueryClient();

    expect(first).not.toBe(second);
    expect(first.getDefaultOptions().queries).toMatchObject({
      staleTime: projectSettings.query.staleTimeMs,
      gcTime: projectSettings.query.gcTimeMs,
      retry: projectSettings.query.retry,
      refetchOnMount: projectSettings.query.refetchOnMount,
      refetchOnReconnect: projectSettings.query.refetchOnReconnect,
      refetchOnWindowFocus: projectSettings.query.refetchOnWindowFocus
    });
  });

  it("creates an isolated paired TanStack runtime", () => {
    const first = createAppRuntime();
    const second = createAppRuntime();

    expect(first.router).not.toBe(second.router);
    expect(first.queryClient).not.toBe(second.queryClient);
    expect(first.router.options.context.queryClient).toBe(first.queryClient);
    expect(second.router.options.context.queryClient).toBe(second.queryClient);
  });
});
