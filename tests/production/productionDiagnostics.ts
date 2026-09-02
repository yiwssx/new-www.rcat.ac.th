import { expect, type ConsoleMessage, type Page, type Request, type Response } from "@playwright/test";

type ProductionDiagnosticKind = "console" | "pageerror" | "requestfailed" | "http";

interface ProductionDiagnosticIssue {
  kind: ProductionDiagnosticKind;
  detail: string;
}

function isSameOrigin(url: string, origin: string) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function formatConsoleMessage(message: ConsoleMessage) {
  const location = message.location();
  const source = location.url ? ` @ ${location.url}:${location.lineNumber}:${location.columnNumber}` : "";
  return `${message.text()}${source}`;
}

function isCriticalHttpFailure(response: Response) {
  const status = response.status();
  if (status >= 500) {
    return true;
  }

  if (status < 400) {
    return false;
  }

  return ["document", "script", "stylesheet"].includes(response.request().resourceType());
}

export function attachProductionDiagnostics(page: Page, baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  const issues: ProductionDiagnosticIssue[] = [];

  page.on("pageerror", (error) => {
    issues.push({ kind: "pageerror", detail: error.stack || error.message });
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    if (/^Failed to load resource:/i.test(message.text())) {
      return;
    }

    const sourceUrl = message.location().url;
    if (sourceUrl && !isSameOrigin(sourceUrl, origin)) {
      return;
    }

    issues.push({ kind: "console", detail: formatConsoleMessage(message) });
  });

  page.on("requestfailed", (request: Request) => {
    if (!isSameOrigin(request.url(), origin)) {
      return;
    }

    const errorText = request.failure()?.errorText || "unknown request failure";
    if (errorText === "net::ERR_ABORTED") {
      return;
    }

    issues.push({
      kind: "requestfailed",
      detail: `${request.method()} ${request.url()} -> ${errorText}`
    });
  });

  page.on("response", (response: Response) => {
    if (!isSameOrigin(response.url(), origin) || !isCriticalHttpFailure(response)) {
      return;
    }

    issues.push({
      kind: "http",
      detail: `${response.status()} ${response.request().method()} ${response.url()}`
    });
  });

  return {
    assertClean() {
      const detail = issues.map((issue) => `[${issue.kind}] ${issue.detail}`).join("\n");
      expect(issues, detail || "Production diagnostics should be clean").toEqual([]);
    }
  };
}
