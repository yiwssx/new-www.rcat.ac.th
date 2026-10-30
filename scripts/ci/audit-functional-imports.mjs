import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { posix, relative, resolve } from "node:path";
import ts from "typescript";

const SCRIPT_FILE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const MAX_FILES = 2500;
const MAX_REACHABLE = 2500;

function modulePath(from, request, files) {
  if (!request.startsWith(".")) return null;
  const prefix = posix.normalize(posix.join(posix.dirname(from), request));
  if (!prefix.startsWith("src/") || prefix.includes("../")) return null;
  for (const candidate of [
    prefix,
    ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"].map((ext) => prefix + ext),
    ...["/index.ts", "/index.tsx", "/index.js", "/index.jsx"].map((ext) => prefix + ext)
  ]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

export function scanModuleImports(file, source) {
  const kind = file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const requests = [];
  let opaqueImports = 0;
  function record(value) {
    if (value && ts.isStringLiteralLike(value)) requests.push(value.text);
    else opaqueImports += 1;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) record(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        record(node.arguments[0]);
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        record(node.arguments[0]);
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.kind === ts.SyntaxKind.MetaProperty &&
        node.expression.name.text === "glob"
      ) {
        // Vite import.meta.glob is a filesystem pattern, not an explicit import edge.
        opaqueImports += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { requests, opaqueImports };
}

/**
 * Diagnostic reverse import reachability only. Even a complete static graph cannot
 * prove browser behavior, runtime routing, mock effects, CSS, or auth coverage.
 * Never feed candidateSpecs into test selection or the required quality gate.
 */
export function auditSourceImportGraph(files, changedPaths, explicitOwners) {
  if (!(files instanceof Map) || files.size > MAX_FILES || !Array.isArray(changedPaths)) {
    throw new Error("Invalid or unbounded source graph");
  }
  const importers = new Map();
  const ambiguous = new Map();
  let scanned = 0;
  for (const [file, source] of files) {
    if (!file.startsWith("src/") || !SCRIPT_FILE.test(file) || typeof source !== "string") continue;
    scanned += 1;
    const { requests, opaqueImports } = scanModuleImports(file, source);
    let unresolved = opaqueImports;
    for (const request of requests) {
      if (!request.startsWith(".")) continue;
      const dependency = modulePath(file, request, files);
      if (!dependency) {
        unresolved += 1;
        continue;
      }
      if (!importers.has(dependency)) importers.set(dependency, new Set());
      importers.get(dependency).add(file);
    }
    if (unresolved) ambiguous.set(file, unresolved);
  }

  const visited = new Set();
  const queue = [...changedPaths];
  for (const file of queue) {
    if (!files.has(file)) throw new Error("Missing changed file in graph: " + file);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (visited.has(current)) continue;
    visited.add(current);
    if (visited.size > MAX_REACHABLE) throw new Error("Source graph exceeds audited limit");
    for (const importer of importers.get(current) ?? []) {
      if (!visited.has(importer)) queue.push(importer);
    }
  }
  const owners = [...visited].filter((path) => Object.hasOwn(explicitOwners, path)).sort();
  const candidateSpecs = [...new Set(owners.flatMap((path) => explicitOwners[path]))].sort();
  const opaqueReachable = [...visited].filter((path) => ambiguous.has(path)).sort();
  return {
    scanned,
    reached: visited.size,
    ownerAnchors: owners,
    candidateSpecs,
    opaqueReachable: opaqueReachable.slice(0, 12),
    opaqueCount: opaqueReachable.length,
    // A graph is advisory even when every relative import resolves.
    safeToSkipFullE2E: false
  };
}

export function formatSourceGraphAudit(audit) {
  return [
    "#### Static source import reachability (diagnostic; no E2E selection)",
    "",
    "- Scanned source modules: " + audit.scanned,
    "- Reachable changed sources/importers: " + audit.reached,
    "- Manually reviewed owner anchors reachable: " + audit.ownerAnchors.length,
    "- Potential browser specs (not exhaustive): " + audit.candidateSpecs.length,
    "- Modules containing opaque/dynamic/unresolved imports: " + audit.opaqueCount,
    "- Full browser suite remains required; static imports do not establish route, test, CSS or runtime coverage.",
    ...(audit.opaqueReachable.length
      ? ["- Example ambiguous modules: " + audit.opaqueReachable.map((path) => "`" + path + "`").join(", ")]
      : []),
    ""
  ].join("\n");
}

export function loadSourceModules(root = process.cwd()) {
  const modules = new Map();
  const base = resolve(root, "src");
  const stack = [base];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && SCRIPT_FILE.test(entry.name) && !/\.(?:test|spec|d)\.[jt]sx?$/.test(entry.name)) {
        const path = relative(root, full).replaceAll("\\", "/");
        if (modules.size >= MAX_FILES) throw new Error("Source module budget exceeded");
        if (lstatSync(full).isFile()) modules.set(path, readFileSync(full, "utf8"));
      }
    }
  }
  return modules;
}
