const MAX_REPORT_BYTES = 32 * 1024;
const MAX_TEXT_LENGTH = 512;

function trimText(value) {
  return String(value || "")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function sanitizeUri(value) {
  const raw = trimText(value);
  if (!raw) return "";
  if (/^(data|blob|inline|eval):/i.test(raw)) return raw.split(":", 1)[0].toLowerCase();

  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, MAX_TEXT_LENGTH);
  } catch {
    return raw.split(/[?#]/, 1)[0].slice(0, MAX_TEXT_LENGTH);
  }
}

function readReportBody(payload) {
  if (Array.isArray(payload)) {
    return payload[0]?.body || payload[0] || {};
  }

  if (payload && typeof payload === "object") {
    return payload["csp-report"] || payload.body || payload;
  }

  return {};
}

export function normalizeCspReportPayload(payload) {
  const report = readReportBody(payload);
  if (!report || typeof report !== "object" || Array.isArray(report)) return null;

  const effectiveDirective = trimText(report["effective-directive"] || report.effectiveDirective);
  const violatedDirective = trimText(report["violated-directive"] || report.violatedDirective);
  const blockedUri = sanitizeUri(report["blocked-uri"] || report.blockedURL || report.blockedUrl);
  const documentUri = sanitizeUri(report["document-uri"] || report.documentURL || report.documentUrl);
  const sourceFile = sanitizeUri(report["source-file"] || report.sourceFile);
  const disposition = trimText(report.disposition);
  const lineNumber = Number(report["line-number"] || report.lineNumber || 0);
  const statusCode = Number(report["status-code"] || report.statusCode || 0);

  if (!effectiveDirective && !violatedDirective && !blockedUri) return null;

  return {
    effectiveDirective,
    violatedDirective,
    blockedUri,
    documentUri,
    sourceFile,
    disposition,
    lineNumber: Number.isFinite(lineNumber) ? lineNumber : 0,
    statusCode: Number.isFinite(statusCode) ? statusCode : 0
  };
}

async function readRawBody(request) {
  if (request.body !== undefined && request.body !== null) {
    if (typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
    const buffered = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body));
    if (buffered.length > MAX_REPORT_BYTES) throw new RangeError("CSP report is too large");
    return buffered.length ? JSON.parse(buffered.toString("utf8")) : {};
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffered = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffered.length;
    if (totalBytes > MAX_REPORT_BYTES) throw new RangeError("CSP report is too large");
    chunks.push(buffered);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export default async function cspReport(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).end();
    return;
  }

  try {
    const payload = await readRawBody(request);
    const report = normalizeCspReportPayload(payload);

    if (report) {
      console.warn("CSP report-only violation", report);
    }

    response.status(204).end();
  } catch (error) {
    if (error instanceof RangeError) {
      response.status(413).end();
      return;
    }

    console.warn("Rejected malformed CSP report", {
      message: error instanceof Error ? error.message : String(error)
    });
    response.status(204).end();
  }
}
