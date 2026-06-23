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
  });

  it("renders snapshot stats immediately and updates live fields without replacing historical fields", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

  it("shows snapshot stats immediately when they arrive after the first render", () => {
    getLiveVisitorStatsMock.mockReturnValue(new Promise(() => undefined));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  });

  it("keeps the initial snapshot and backs off polling when live visitor stats fail", async () => {
    vi.useFakeTimers();
    getLiveVisitorStatsMock.mockRejectedValue(
      new Error("visitor-presence-schema-missing-v1: run 0006_m20_visitor_presence.sql")
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  });
});
