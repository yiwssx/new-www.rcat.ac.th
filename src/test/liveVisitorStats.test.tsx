import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLiveVisitorStats } from "../features/visitor-stats/api";
import { VisitorStatsCard } from "../public/components/home/VisitorStatsCard";
import { resetLiveVisitorStatsBackoffForTests, useLiveVisitorStats } from "../public/hooks/useLiveVisitorStats";
import type { VisitorStatsSettings } from "../features/visitor-stats";

vi.mock("../features/visitor-stats/api", () => ({
  getLiveVisitorStats: vi.fn()
}));

vi.mock("../config/publicApiProvider", () => ({
  getPublicApiProvider: () => "cloudflare"
}));

const getLiveVisitorStatsMock = vi.mocked(getLiveVisitorStats);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

const initialStats: VisitorStatsSettings = {
  enabled: true,
  usersToday: 8,
  usersYesterday: 7,
  usersThisMonth: 30,
  usersThisYear: 80,
  totalUsers: 120,
  totalViews: 200,
  onlineUsers: 1,
  updatedAt: "2026-06-22T04:00:00.000Z"
};

function LiveStatsHarness({ stats: initial }: { stats: VisitorStatsSettings | undefined }) {
  const stats = useLiveVisitorStats(initial);
  return <VisitorStatsCard stats={stats} />;
}

describe("live public visitor stats", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetLiveVisitorStatsBackoffForTests();
    getLiveVisitorStatsMock.mockReset();
    getLiveVisitorStatsMock.mockResolvedValue({
      ...initialStats,
      usersToday: 9,
      totalViews: 201,
      onlineUsers: 3,
      updatedAt: "2026-06-22T04:01:00.000Z"
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders snapshot stats immediately and updates live fields without replacing historical fields", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <LiveStatsHarness stats={initialStats} />
      </QueryClientProvider>
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
  });

  it("shows snapshot stats immediately when they arrive after the first render", async () => {
    const pendingStats = createDeferred<VisitorStatsSettings>();
    getLiveVisitorStatsMock.mockReturnValue(pendingStats.promise);
    const queryClient = createTestQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <LiveStatsHarness stats={undefined} />
      </QueryClientProvider>
    );

    expect(screen.queryByLabelText("Website Visitors")).not.toBeInTheDocument();
    rerender(
      <QueryClientProvider client={queryClient}>
        <LiveStatsHarness stats={initialStats} />
      </QueryClientProvider>
    );

    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");

    await act(async () => {
      pendingStats.resolve({ ...initialStats, onlineUsers: 3 });
      await pendingStats.promise;
    });
  });

  it("keeps the initial snapshot and backs off polling when live visitor stats fail", async () => {
    vi.useFakeTimers();
    const expectedError = new Error("visitor-presence-schema-missing-v1: run 0006_m20_visitor_presence.sql");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    getLiveVisitorStatsMock.mockRejectedValue(expectedError);
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <LiveStatsHarness stats={initialStats} />
      </QueryClientProvider>
    );

    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");
    expect(warnSpy).toHaveBeenCalledWith(
      "Live visitor stats are temporarily unavailable; keeping the public snapshot.",
      expectedError
    );
  });
});
