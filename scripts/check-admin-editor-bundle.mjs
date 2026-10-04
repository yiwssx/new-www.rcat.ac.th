import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { build } from "vite";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_EDITOR_CHUNK_RAW_BYTES = 400_000;
const FIRST_OPEN_BASELINE_GZIP_BYTES = 153_240;
const FIRST_OPEN_TARGET_GZIP_BYTES = 138_000;

const SOURCE_PATHS = Object.freeze({
  contentPage: "/src/admin/pages/ContentPage.tsx",
  editorDialog: "/src/admin/components/ContentEditorDialog.tsx",
  richTextEditor: "/src/admin/components/RichTextEditorImpl.tsx",
  optionalMode: "/src/admin/components/RichTextEditorOptionalMode.tsx",
  mediaPicker: "/src/admin/components/RichTextMediaPickerDialogImpl.tsx"
});

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

function normalizeBuildOutputs(buildResult) {
  const outputs = (Array.isArray(buildResult) ? buildResult : [buildResult]).flatMap((result) => result.output);
  if (outputs.length === 0) {
    throw new Error("Vite returned no in-memory build output.");
  }
  return outputs;
}

function getJavaScriptChunks(outputs) {
  const chunks = outputs.filter((output) => output?.type === "chunk" && typeof output.fileName === "string");
  if (chunks.length === 0) {
    throw new Error("Vite returned no JavaScript chunks.");
  }
  return chunks;
}

function findOwningChunk(chunks, sourcePath) {
  const normalizedSource = normalizePath(sourcePath);
  const matches = chunks.filter((chunk) =>
    Object.keys(chunk.modules ?? {}).some((moduleId) => normalizePath(moduleId).endsWith(normalizedSource))
  );
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one emitted owner for ${sourcePath}, found ${matches.length}.`);
  }
  return matches[0];
}

function collectStaticChunkClosure(chunksByFile, entryFile) {
  const visited = new Set();

  function visit(fileName) {
    if (visited.has(fileName)) {
      return;
    }

    const chunk = chunksByFile.get(fileName);
    if (!chunk) {
      throw new Error(`Missing emitted chunk ${fileName} while walking the static editor graph.`);
    }

    visited.add(fileName);
    for (const importedFile of chunk.imports ?? []) {
      visit(importedFile);
    }
  }

  visit(entryFile);
  return visited;
}

function measureChunk(chunk) {
  const bytes = Buffer.from(chunk.code, "utf8");
  return {
    fileName: chunk.fileName,
    rawBytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length
  };
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
  const chunks = getJavaScriptChunks(normalizeBuildOutputs(await createInMemoryProductionBuild()));
  const chunksByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));

  const contentPage = findOwningChunk(chunks, SOURCE_PATHS.contentPage);
  const editorDialog = findOwningChunk(chunks, SOURCE_PATHS.editorDialog);
  const richTextEditor = findOwningChunk(chunks, SOURCE_PATHS.richTextEditor);
  const optionalMode = findOwningChunk(chunks, SOURCE_PATHS.optionalMode);
  const mediaPicker = findOwningChunk(chunks, SOURCE_PATHS.mediaPicker);

  const initialContentGraph = collectStaticChunkClosure(chunksByFile, contentPage.fileName);
  const editorFirstOpenGraph = new Set([
    ...collectStaticChunkClosure(chunksByFile, editorDialog.fileName),
    ...collectStaticChunkClosure(chunksByFile, richTextEditor.fileName)
  ]);

  for (const alreadyLoaded of initialContentGraph) {
    editorFirstOpenGraph.delete(alreadyLoaded);
  }

  const measurements = [...editorFirstOpenGraph]
    .map((fileName) => measureChunk(chunksByFile.get(fileName)))
    .sort((left, right) => right.rawBytes - left.rawBytes);
  const aggregateGzipBytes = measurements.reduce((total, measurement) => total + measurement.gzipBytes, 0);
  const largestRawBytes = measurements[0]?.rawBytes ?? 0;
  const deferredLeaks = [optionalMode.fileName, mediaPicker.fileName].filter((fileName) =>
    editorFirstOpenGraph.has(fileName)
  );

  const failures = [];
  if (measurements.length === 0) {
    failures.push("first-editor-open graph is empty");
  }
  if (largestRawBytes >= MAX_EDITOR_CHUNK_RAW_BYTES) {
    failures.push(
      `largest first-open editor chunk is ${largestRawBytes} bytes; must be < ${MAX_EDITOR_CHUNK_RAW_BYTES} bytes`
    );
  }
  if (aggregateGzipBytes > FIRST_OPEN_TARGET_GZIP_BYTES) {
    failures.push(
      `first-editor-open aggregate gzip is ${aggregateGzipBytes} bytes; target is <= ${FIRST_OPEN_TARGET_GZIP_BYTES} bytes`
    );
  }
  if (deferredLeaks.length > 0) {
    failures.push(`deferred editor capabilities leaked into first open: ${deferredLeaks.join(", ")}`);
  }

  console.log("Admin editor bundle evidence:");
  console.log(`- initial content-list owner: ${contentPage.fileName}`);
  console.log(`- first-open incremental JS chunks: ${measurements.length}`);
  for (const measurement of measurements) {
    console.log(`  - ${measurement.fileName}: raw ${measurement.rawBytes}; gzip ${measurement.gzipBytes}`);
  }
  console.log(`- largest first-open raw chunk: ${largestRawBytes}; limit < ${MAX_EDITOR_CHUNK_RAW_BYTES}`);
  console.log(
    `- first-open aggregate gzip: ${aggregateGzipBytes}; baseline ${FIRST_OPEN_BASELINE_GZIP_BYTES}; target <= ${FIRST_OPEN_TARGET_GZIP_BYTES}; delta ${aggregateGzipBytes - FIRST_OPEN_BASELINE_GZIP_BYTES}`
  );
  console.log(
    `- deferred optional-content chunk: ${optionalMode.fileName}; ${editorFirstOpenGraph.has(optionalMode.fileName) ? "LEAK" : "deferred"}`
  );
  console.log(
    `- deferred media-picker chunk: ${mediaPicker.fileName}; ${editorFirstOpenGraph.has(mediaPicker.fileName) ? "LEAK" : "deferred"}`
  );
  console.log(`Admin editor bundle result: ${failures.length === 0 ? "PASS" : "FAIL"}`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to check the Admin editor bundle: ${message}`);
  process.exitCode = 1;
});
