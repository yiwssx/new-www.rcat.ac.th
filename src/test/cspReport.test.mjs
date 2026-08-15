import { describe, expect, it } from "vitest";
import { normalizeCspReportPayload } from "../../server/cspReport/handler.mjs";

describe("CSP report collector", () => {
  it("normalizes legacy CSP reports without retaining query strings", () => {
    expect(
      normalizeCspReportPayload({
        "csp-report": {
          "effective-directive": "script-src-elem",
          "violated-directive": "script-src 'self'",
          "blocked-uri": "https://cdn.example.test/script.js?token=sensitive#fragment",
          "document-uri": "https://www.rcat.ac.th/news?draft=1",
          "source-file": "https://www.rcat.ac.th/assets/app.js?v=123",
          "line-number": 42,
          "status-code": 200,
          disposition: "report"
        }
      })
    ).toEqual({
      effectiveDirective: "script-src-elem",
      violatedDirective: "script-src 'self'",
      blockedUri: "https://cdn.example.test/script.js",
      documentUri: "https://www.rcat.ac.th/news",
      sourceFile: "https://www.rcat.ac.th/assets/app.js",
      disposition: "report",
      lineNumber: 42,
      statusCode: 200
    });
  });

  it("accepts Reporting API payloads and reduces inline/data values to schemes", () => {
    expect(
      normalizeCspReportPayload([
        {
          type: "csp-violation",
          body: {
            effectiveDirective: "style-src-elem",
            blockedURL: "data:text/css;base64,secret",
            documentURL: "https://www.rcat.ac.th/",
            sourceFile: "inline:style"
          }
        }
      ])
    ).toMatchObject({
      effectiveDirective: "style-src-elem",
      blockedUri: "data",
      documentUri: "https://www.rcat.ac.th/",
      sourceFile: "inline"
    });
  });

  it("drops payloads that do not contain a usable CSP violation", () => {
    expect(normalizeCspReportPayload({ arbitrary: "value" })).toBeNull();
  });
});
