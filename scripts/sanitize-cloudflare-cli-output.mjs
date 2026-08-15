import fs from "node:fs";
import { pathToFileURL } from "node:url";

const MAX_DIAGNOSTIC_CHARS = 16_000;

function readArgument(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  return index >= 0 ? String(argv[index + 1] || "").trim() : "";
}

export function sanitizeCloudflareCliOutput(input) {
  return String(input || "")
    .replace(/(authorization\s*:\s*(?:bearer|basic)\s+)[^\s"']+/gi, "$1***")
    .replace(/(CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)\s*[:=]\s*)[^\s"']+/gi, "$1***")
    .replace(/(\/accounts\/)[A-Za-z0-9_-]+/g, "$1***")
    .replace(/(\/d1\/database\/)[A-Fa-f0-9-]+/g, "$1***")
    .replace(/\b[a-f0-9]{32}\b/gi, "***")
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, "***");
}

export function formatCloudflareCliDiagnostic(input, { label = "wrangler output", limit = MAX_DIAGNOSTIC_CHARS } = {}) {
  const sanitized = sanitizeCloudflareCliOutput(input).trim();
  if (!sanitized) {
    return `[${label}] (no output)`;
  }

  const clipped = sanitized.length > limit ? `${sanitized.slice(0, limit)}\n[diagnostic output truncated]` : sanitized;
  return `[${label}]\n${clipped}`;
}

export function main(argv = process.argv.slice(2)) {
  const file = readArgument("--file", argv);
  const label = readArgument("--label", argv) || "wrangler output";

  if (!file) {
    throw new Error("--file is required");
  }

  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  console.error(formatCloudflareCliDiagnostic(raw, { label }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
