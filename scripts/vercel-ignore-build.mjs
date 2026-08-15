import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const NON_RUNTIME_PREFIXES = [
  ".github/",
  ".husky/",
  "apps-script/",
  "cloudflare/",
  "docs/",
  "imports/",
  "src/test/"
];

const RUNTIME_EXACT_FILES = new Set([
  "index.html",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.ts",
  "tsconfig.json",
  "vercel.json",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts"
]);

const RUNTIME_PREFIXES = ["api/", "public/", "server/"];
const RUNTIME_BUILD_SCRIPTS = new Set(["scripts/prepare-ssr-cutover-output.mjs"]);
const TEST_FILE_PATTERN = /(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/;

export function isVercelRuntimeImpactingPath(path) {
  const normalized = String(path || "").replaceAll("\\", "/");

  if (!normalized) return true;
  if (RUNTIME_EXACT_FILES.has(normalized)) return true;
  if (RUNTIME_BUILD_SCRIPTS.has(normalized)) return true;
  if (RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;

  if (normalized.startsWith("src/")) {
    return !TEST_FILE_PATTERN.test(normalized);
  }

  if (NON_RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (TEST_FILE_PATTERN.test(normalized)) return false;

  // Unknown paths are conservative: build rather than risk skipping a runtime change.
  return true;
}

export function shouldIgnoreVercelBuild(paths) {
  return paths.length > 0 && paths.every((path) => !isVercelRuntimeImpactingPath(path));
}

function readChangedPaths() {
  try {
    const parent = execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const output = execFileSync("git", ["diff", "--name-only", "-z", parent, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"]
    });
    return output.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

function main() {
  const changedPaths = readChangedPaths();

  if (!changedPaths) {
    console.log("Vercel build required: unable to resolve the previous commit safely.");
    process.exit(1);
  }

  const runtimePaths = changedPaths.filter(isVercelRuntimeImpactingPath);

  if (runtimePaths.length === 0 && changedPaths.length > 0) {
    console.log(`Vercel build ignored: ${changedPaths.length} non-runtime path(s) changed.`);
    process.exit(0);
  }

  console.log("Vercel build required for runtime-impacting path(s):");
  for (const path of runtimePaths) console.log(`- ${path}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
