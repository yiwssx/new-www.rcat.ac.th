/* global console, process */
import { URL, pathToFileURL } from "node:url";

export const REQUIRED_ENV_KEYS = [
  "RCAT_PROD_D1_DATABASE_NAME",
  "RCAT_PROD_D1_DATABASE_ID",
  "RCAT_PROD_WORKER_URL",
  "RCAT_PROD_FRONTEND_URL",
  "RCAT_PROD_CUTOVER_APPROVAL"
];

const REQUIRED_APPROVAL = "APPROVED_MANUAL_CUTOVER";
const NON_PRODUCTION_NAME_PATTERN = /(^|[-_.\s])(preview|local|test|dev|staging|sandbox)([-_.\s]|$)/i;
const PRODUCTION_NAME_PATTERN = /(^|[-_.\s])(prod|production)([-_.\s]|$)/i;
const FORBIDDEN_HOST_PARTS = ["script.google.com", "drive.google.com"];
const LOCAL_HOST_PATTERN = /(^localhost$|^127\.|^0\.0\.0\.0$|^\[?::1\]?$)/i;
const PREVIEW_FRONTEND_SUFFIX = `${"ver"}${"cel"}.app`;

function readValue(env, key) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function redactValue(value) {
  if (value.length <= 8) {
    return "present (redacted)";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function hostIncludesForbiddenPart(hostname) {
  const normalizedHostname = hostname.toLowerCase();

  return FORBIDDEN_HOST_PARTS.some((forbiddenPart) => normalizedHostname.includes(forbiddenPart));
}

function validateUrl(value, key, reasons, options = {}) {
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    reasons.push(`${key} must be a valid HTTPS URL.`);
    return undefined;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (parsedUrl.protocol !== "https:") {
    reasons.push(`${key} must use HTTPS.`);
  }

  if (LOCAL_HOST_PATTERN.test(hostname)) {
    reasons.push(`${key} must not use localhost.`);
  }

  if (hostIncludesForbiddenPart(hostname)) {
    reasons.push(`${key} must not include forbidden storage or Apps Script hosts.`);
  }

  if (options.rejectPreviewWorker && hostname.endsWith("workers.dev") && /preview|staging|test|dev/i.test(hostname)) {
    reasons.push(`${key} must not look like a preview Worker URL.`);
  }

  if (
    options.rejectPreviewFrontend &&
    hostname.endsWith(PREVIEW_FRONTEND_SUFFIX) &&
    /preview|staging|test|dev|git-/i.test(hostname)
  ) {
    reasons.push(`${key} must not look like a preview frontend URL.`);
  }

  return parsedUrl;
}

export function runProductionCutoverPreflight(env = process.env) {
  const values = Object.fromEntries(REQUIRED_ENV_KEYS.map((key) => [key, readValue(env, key)]));
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => values[key] === "");
  const reasons = [];

  if (missingKeys.length > 0) {
    return {
      status: "BLOCKED",
      missingKeys,
      reasons,
      safeSummary: {}
    };
  }

  const d1DatabaseName = values.RCAT_PROD_D1_DATABASE_NAME;
  const d1DatabaseId = values.RCAT_PROD_D1_DATABASE_ID;

  if (d1DatabaseName === "rcat-public-api-preview" || d1DatabaseName === "rcat-public-api-local") {
    reasons.push("RCAT_PROD_D1_DATABASE_NAME must not equal a preview or local database name.");
  }

  if (NON_PRODUCTION_NAME_PATTERN.test(d1DatabaseName)) {
    reasons.push("RCAT_PROD_D1_DATABASE_NAME must not look like preview/local/test.");
  }

  if (!PRODUCTION_NAME_PATTERN.test(d1DatabaseName)) {
    reasons.push("RCAT_PROD_D1_DATABASE_NAME must include prod or production.");
  }

  if (d1DatabaseId === "preview-placeholder") {
    reasons.push("RCAT_PROD_D1_DATABASE_ID must not be preview-placeholder.");
  }

  if (d1DatabaseId === "local-placeholder") {
    reasons.push("RCAT_PROD_D1_DATABASE_ID must not be local-placeholder.");
  }

  const workerUrl = validateUrl(values.RCAT_PROD_WORKER_URL, "RCAT_PROD_WORKER_URL", reasons, {
    rejectPreviewWorker: true
  });
  const frontendUrl = validateUrl(values.RCAT_PROD_FRONTEND_URL, "RCAT_PROD_FRONTEND_URL", reasons, {
    rejectPreviewFrontend: true
  });

  if (values.RCAT_PROD_CUTOVER_APPROVAL !== REQUIRED_APPROVAL) {
    reasons.push("RCAT_PROD_CUTOVER_APPROVAL must equal APPROVED_MANUAL_CUTOVER; M8 does not execute cutover.");
  }

  return {
    status: reasons.length > 0 ? "BLOCKED" : "READY",
    missingKeys,
    reasons,
    safeSummary: {
      d1DatabaseName,
      d1DatabaseIdRedacted: redactValue(d1DatabaseId),
      workerOrigin: workerUrl?.origin,
      frontendOrigin: frontendUrl?.origin,
      approvalPresent: values.RCAT_PROD_CUTOVER_APPROVAL === REQUIRED_APPROVAL
    }
  };
}

export function formatProductionPreflightResult(result) {
  const lines = [result.status];

  if (result.missingKeys.length > 0) {
    lines.push("", "Missing required environment variables:");
    result.missingKeys.forEach((key) => {
      lines.push(`- ${key}`);
    });
  }

  if (result.reasons.length > 0) {
    lines.push("", "Validation issues:");
    result.reasons.forEach((reason) => {
      lines.push(`- ${reason}`);
    });
  }

  if (result.status === "READY") {
    lines.push(
      "",
      "Production cutover preflight passed for local inputs.",
      `D1 database name: ${result.safeSummary.d1DatabaseName}`,
      `D1 database id: ${result.safeSummary.d1DatabaseIdRedacted}`,
      `Worker origin: ${result.safeSummary.workerOrigin}`,
      `Frontend origin: ${result.safeSummary.frontendOrigin}`,
      `Approval: ${result.safeSummary.approvalPresent ? "present" : "missing"}`
    );
  }

  lines.push("", "No production commands were run.");

  return lines.join("\n");
}

export function main() {
  console.log(formatProductionPreflightResult(runProductionCutoverPreflight()));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
