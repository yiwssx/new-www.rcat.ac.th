import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SilentTelemetryBoundary } from "../shared/telemetry/SilentTelemetryBoundary";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SilentTelemetryBoundary", () => {
  it("renders healthy optional telemetry children", () => {
    render(
      <SilentTelemetryBoundary>
        <span>telemetry mounted</span>
      </SilentTelemetryBoundary>
    );

    expect(screen.getByText("telemetry mounted")).toBeInTheDocument();
  });

  it("keeps the Public page rendered without displaying an error when telemetry fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    function BrokenTelemetry(): never {
      throw new Error("optional telemetry failed");
    }

    render(
      <>
        <main>Public page remains available</main>
        <SilentTelemetryBoundary>
          <BrokenTelemetry />
        </SilentTelemetryBoundary>
      </>
    );

    expect(screen.getByRole("main")).toHaveTextContent("Public page remains available");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/optional telemetry failed/iu)).not.toBeInTheDocument();
  });
});
