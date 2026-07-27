import { isPublicTelemetryPath, normalizePublicTelemetryPath } from "./publicTelemetryRoutes";

interface VercelTelemetryEvent {
  type: string;
  url: string;
}

interface VercelSpeedInsightEvent extends VercelTelemetryEvent {
  route?: string;
}

function getSafeVercelEventPath(event: VercelTelemetryEvent) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const eventUrl = new URL(event.url, window.location.origin);
    const eventPath = normalizePublicTelemetryPath(eventUrl.pathname);
    const currentPath = normalizePublicTelemetryPath(window.location.pathname);

    if (!isPublicTelemetryPath(eventPath) || !isPublicTelemetryPath(currentPath)) {
      return null;
    }

    return eventPath;
  } catch {
    return null;
  }
}

export function sanitizeVercelAnalyticsEvent<T extends VercelTelemetryEvent>(event: T): T | null {
  const eventPath = getSafeVercelEventPath(event);

  if (!eventPath) {
    return null;
  }

  return {
    ...event,
    url: `${window.location.origin}${eventPath}`
  };
}

export function sanitizeVercelSpeedInsightEvent<T extends VercelSpeedInsightEvent>(event: T): T | null {
  const eventPath = getSafeVercelEventPath(event);

  if (!eventPath) {
    return null;
  }

  return {
    ...event,
    url: `${window.location.origin}${eventPath}`,
    route: eventPath
  };
}
