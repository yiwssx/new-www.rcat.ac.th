import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "vite";
import {
  analyzePublicEntryBuild,
  evaluatePublicPerformanceBudget,
  formatPublicPerformanceBudgetReport,
  parseViteManifestSource
} from "./public-performance-budget.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function normalizeBuildOutputs(buildResult) {
  const outputs = (Array.isArray(buildResult) ? buildResult : [buildResult]).flatMap((result) => result.output);

  if (outputs.length === 0) {
    throw new Error("Vite returned no in-memory build output.");
  }

  return outputs;
}

function findManifestAsset(outputs) {
  const matches = outputs.filter(
    (output) => output.type === "asset" && output.fileName.replaceAll("\\", "/") === ".vite/manifest.json"
  );

  if (matches.length !== 1) {
    throw new Error(`Expected exactly one in-memory Vite manifest, found ${matches.length}.`);
  }

  return matches[0];
}

async function createInMemoryProductionBuild() {
  const viteEnvironment = Object.entries(process.env).filter(([key]) => key.startsWith("VITE_"));

  for (const [key] of viteEnvironment) {
    delete process.env[key];
  }

  try {
    return await build({
      root: repositoryRoot,
      configFile: resolve(repositoryRoot, "vite.config.ts"),
      envDir: false,
      mode: "production",
      logLevel: "warn",
      build: {
        write: false,
        manifest: true,
        sourcemap: false
      }
    });
  } finally {
    for (const [key, value] of viteEnvironment) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const outputs = normalizeBuildOutputs(await createInMemoryProductionBuild());
  const manifest = parseViteManifestSource(findManifestAsset(outputs).source);
  const metrics = analyzePublicEntryBuild({
    manifest,
    outputChunks: outputs
  });
  const result = evaluatePublicPerformanceBudget(metrics);

  console.log(formatPublicPerformanceBudgetReport(result));

  if (!result.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to check the Public performance budget: ${message}`);
  process.exitCode = 1;
});
