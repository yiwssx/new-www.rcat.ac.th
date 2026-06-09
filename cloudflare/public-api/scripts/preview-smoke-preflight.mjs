/* global console, process */
import { URL, pathToFileURL } from "node:url";

export const REQUIRED_ENV_KEYS = [
  "RCAT_PREVIEW_D1_DATABASE_NAME",
  "RCAT_PREVIEW_D1_DATABASE_ID",
  "RCAT_PREVIEW_WORKER_URL",
  "RCAT_VERCEL_PREVIEW_URL"
];

const FORBIDDEN_URL_PARTS = ["rcat.ac.th", "script.google.com", "drive.google.com"];
const PRODUCTION_NAME_PATTERN = /(^|[-_.\s])(prod|production|live)([-_.\s]|$)/i;
const NON_PRODUCTION_NAME_MARKER_PATTERN =
  /(^|[-_.\s])(preview|staging|stage|nonprod|non-production|dev|test|uat|smoke|sandbox)([-_.\s]|$)/i;

function readValue(env, key) {
  const value = env[key];

  return typeof value === "string" ? value.trim() : "";
}

function hasForbiddenUrlPart(value) {
  const normalizedValue = value.toLowerCase();

  return FORBIDDEN_URL_PARTS.some((forbiddenPart) => normalizedValue.includes(forbiddenPart));
}

function validateHttpsUrl(value, key, reasons) {
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch {
    reasons.push(`${key} must be a valid HTTPS URL.`);
    return undefined;
  }

  if (parsedUrl.protocol !== "https:") {
    reasons.push(`${key} must use HTTPS.`);
  }

  if (hasForbiddenUrlPart(value)) {
    reasons.push(`${key} must not include forbidden production domains.`);
  }

  return parsedUrl;
}

export function runPreviewSmokePreflight(env = process.env) {
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

  const d1DatabaseName = values.RCAT_PREVIEW_D1_DATABASE_NAME;
  const d1DatabaseId = values.RCAT_PREVIEW_D1_DATABASE_ID;

  if (PRODUCTION_NAME_PATTERN.test(d1DatabaseName)) {
    reasons.push("RCAT_PREVIEW_D1_DATABASE_NAME must not look like production.");
  }

  if (!NON_PRODUCTION_NAME_MARKER_PATTERN.test(d1DatabaseName)) {
    reasons.push("RCAT_PREVIEW_D1_DATABASE_NAME must include a non-production marker.");
  }

  if (d1DatabaseId === "preview-placeholder") {
    reasons.push("RCAT_PREVIEW_D1_DATABASE_ID must not be preview-placeholder.");
  }

  if (PRODUCTION_NAME_PATTERN.test(d1DatabaseId)) {
    reasons.push("RCAT_PREVIEW_D1_DATABASE_ID must not look like production.");
  }

  const workerUrl = validateHttpsUrl(values.RCAT_PREVIEW_WORKER_URL, "RCAT_PREVIEW_WORKER_URL", reasons);
  const vercelPreviewUrl = validateHttpsUrl(values.RCAT_VERCEL_PREVIEW_URL, "RCAT_VERCEL_PREVIEW_URL", reasons);

  return {
    status: reasons.length > 0 ? "BLOCKED" : "READY",
    missingKeys,
    reasons,
    safeSummary: {
      d1DatabaseName,
      d1DatabaseIdPresent: d1DatabaseId.length > 0,
      workerUrlHost: workerUrl?.host,
      vercelPreviewUrlHost: vercelPreviewUrl?.host
    }
  };
}

export function formatPreflightResult(result) {
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
      "Preview smoke preflight passed.",
      `D1 database name: ${result.safeSummary.d1DatabaseName}`,
      `D1 database id: ${result.safeSummary.d1DatabaseIdPresent ? "present (redacted)" : "missing"}`,
      `Worker URL host: ${result.safeSummary.workerUrlHost}`,
      `Vercel preview URL host: ${result.safeSummary.vercelPreviewUrlHost}`
    );
  }

  lines.push("", "No remote commands were run.");

  return lines.join("\n");
}

export function main() {
  console.log(formatPreflightResult(runPreviewSmokePreflight()));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
