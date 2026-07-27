import { Component, type ReactNode } from "react";

interface SilentTelemetryBoundaryProps {
  children: ReactNode;
}

interface SilentTelemetryBoundaryState {
  failed: boolean;
}

export class SilentTelemetryBoundary extends Component<SilentTelemetryBoundaryProps, SilentTelemetryBoundaryState> {
  state: SilentTelemetryBoundaryState = {
    failed: false
  };

  static getDerivedStateFromError(): SilentTelemetryBoundaryState {
    return {
      failed: true
    };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
