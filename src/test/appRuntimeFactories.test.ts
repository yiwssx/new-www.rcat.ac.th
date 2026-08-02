import { describe, expect, it } from "vitest";
import { projectSettings } from "../config/projectSettings";
import { createAppQueryClient } from "../queryClient";
import { createAppRouter } from "../routes";

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

  it("creates an isolated TanStack Router for each runtime", () => {
    const first = createAppRouter();
    const second = createAppRouter();

    expect(first).not.toBe(second);
  });
});
