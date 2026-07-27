import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLiveVisitorStats } from "../features/visitor-stats/api";
import type { VisitorStatsSettings } from "../features/visitor-stats";
import { VisitorStatsCard } from "../public/components/home/VisitorStatsCard";
import { resetLiveVisitorStatsBackoffForTests, useLiveVisitorStats } from "../public/hooks/useLiveVisitorStats";

const providerState = vi.hoisted(() => ({ value: "cloudflare" }));

vi.mock("../features/visitor-stats/api", () => ({
  getLiveVisitorStats: vi.fn()
}));

vi.mock("../config/publicApiProvider", () => ({
  getPublicApiProvider: () => providerState.value
}));

const getLiveVisitorStatsMock = vi.mocked(getLiveVisitorStats);
const TEST_NOW = new Date("2026-07-27T00:00:00.000Z").getTime();

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
  updatedAt: "2026-07-27T00:00:00.000Z"
};

const liveStats: VisitorStatsSettings = {
  ...initialStats,
  usersToday: 9,
  totalViews: 201,
  onlineUsers: 3,
  updatedAt: "2026-07-27T00:01:00.000Z"
};

function LiveStatsHarness({
  stats: initial,
  initialDataUpdatedAt = TEST_NOW
}: {
  stats: VisitorStatsSettings | undefined;
  initialDataUpdatedAt?: number;
}) {
  const stats = useLiveVisitorStats(initial, initialDataUpdatedAt);
  return <VisitorStatsCard stats={stats} />;
}

function renderLiveStats(stats: VisitorStatsSettings | undefined = initialStats, initialDataUpdatedAt = TEST_NOW) {
  const queryClient = createTestQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LiveStatsHarness stats={stats} initialDataUpdatedAt={initialDataUpdatedAt} />
    </QueryClientProvider>
  );

  return { queryClient, ...view };
}

async function flushTimers() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("live public visitor stats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    providerState.value = "cloudflare";
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
    resetLiveVisitorStatsBackoffForTests();
    getLiveVisitorStatsMock.mockReset();
    getLiveVisitorStatsMock.mockResolvedValue(liveStats);
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
    resetLiveVisitorStatsBackoffForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses a fresh public snapshot without an immediate duplicate GET and refreshes once at 60 seconds", async () => {
    const pendingStats = createDeferred<VisitorStatsSettings>();
    getLiveVisitorStatsMock.mockReturnValue(pendingStats.promise);
    renderLiveStats();

    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");
    expect(screen.getByText("7")).toBeInTheDocument();
    await flushTimers();
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushTimers();
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");

    await act(async () => {
      pendingStats.resolve(liveStats);
      await pendingStats.promise;
    });
    await flushTimers();
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online3");
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("refreshes an already stale snapshot on mount while retaining it during the request", async () => {
    const pendingStats = createDeferred<VisitorStatsSettings>();
    getLiveVisitorStatsMock.mockReturnValue(pendingStats.promise);
    renderLiveStats(initialStats, TEST_NOW - 60_001);

    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");
    await flushTimers();
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingStats.resolve(liveStats);
      await pendingStats.promise;
    });
    await flushTimers();
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online3");
  });

  it("deduplicates the live GET for multiple consumers sharing the query key", async () => {
    const pendingStats = createDeferred<VisitorStatsSettings>();
    getLiveVisitorStatsMock.mockReturnValue(pendingStats.promise);
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <LiveStatsHarness stats={initialStats} />
        <LiveStatsHarness stats={initialStats} />
      </QueryClientProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingStats.resolve(liveStats);
      await pendingStats.promise;
    });
  });

  it("does not poll while hidden and refreshes once when a stale page becomes visible", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    focusManager.setFocused(false);
    renderLiveStats();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      focusManager.setFocused(true);
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
  });

  it("does not refetch on focus or reconnect while fresh", async () => {
    renderLiveStats();

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await Promise.resolve();
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();
  });

  it("refreshes once on reconnect when stale and keeps subsequent fresh reconnects bounded", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    renderLiveStats();

    await act(async () => {
      onlineManager.setOnline(false);
      await vi.advanceTimersByTimeAsync(60_001);
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      onlineManager.setOnline(true);
      await Promise.resolve();
    });
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await Promise.resolve();
    });
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
  });

  it("retains the snapshot and enforces the full five-minute backoff across focus and reconnect", async () => {
    const expectedError = new Error("visitor stats unavailable");
    const recoveredStats = createDeferred<VisitorStatsSettings>();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    getLiveVisitorStatsMock.mockRejectedValueOnce(expectedError).mockReturnValueOnce(recoveredStats.promise);
    const failedView = renderLiveStats(initialStats, TEST_NOW - 60_001);

    await flushTimers();
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");

    failedView.unmount();
    renderLiveStats(initialStats, TEST_NOW - 60_001);
    await flushTimers();
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
    });
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flushTimers();
    expect(getLiveVisitorStatsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online1");

    await act(async () => {
      recoveredStats.resolve(liveStats);
      await recoveredStats.promise;
    });
    await flushTimers();
    expect(screen.getByLabelText("Website Visitors")).toHaveTextContent("Who's Online3");
    expect(warnSpy).toHaveBeenCalledWith(
      "Live visitor stats are temporarily unavailable; keeping the public snapshot.",
      expectedError
    );
  });

  it("stops polling after unmount", async () => {
    const view = renderLiveStats();

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();
  });

  it("does not request live stats when disabled or when Cloudflare is not selected", async () => {
    const disabledView = renderLiveStats({ ...initialStats, enabled: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();
    disabledView.unmount();

    providerState.value = "apps-script";
    renderLiveStats();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(getLiveVisitorStatsMock).not.toHaveBeenCalled();
  });
});
