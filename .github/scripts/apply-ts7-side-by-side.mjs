import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(path, needle, replacement) {
  const text = readFileSync(path, "utf8");
  const index = text.indexOf(needle);
  if (index === -1) throw new Error(`Expected text not found in ${path}: ${needle.slice(0, 100)}`);
  if (text.indexOf(needle, index + needle.length) !== -1) {
    throw new Error(`Expected text to be unique in ${path}: ${needle.slice(0, 100)}`);
  }
  writeFileSync(path, `${text.slice(0, index)}${replacement}${text.slice(index + needle.length)}`);
}

function replaceRegexOnce(path, pattern, replacement) {
  const text = readFileSync(path, "utf8");
  const matches = [...text.matchAll(new RegExp(pattern.source, `${pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`}`))];
  if (matches.length !== 1) throw new Error(`Expected one regex match in ${path}, got ${matches.length}: ${pattern}`);
  writeFileSync(path, text.replace(pattern, replacement));
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.devDependencies.typescript = "npm:@typescript/typescript6@6.0.3";
pkg.devDependencies["@typescript/native"] = "npm:typescript@7.0.2";
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const dependencyPolicy = JSON.parse(readFileSync("config/dependency-policy.json", "utf8"));
dependencyPolicy.compatibilityExceptions.typescript = {
  selected: "6.0.3",
  blockedLatestMajor: 7,
  reason:
    "The typescript package name remains a TypeScript 6 API compatibility alias required by typescript-eslint, while @typescript/native supplies the TypeScript 7 compiler for build and type-check commands.",
  validation: {
    kind: "peer-range",
    peerPackage: "typescript-eslint",
    peerDependency: "typescript"
  },
  verifyWith: [
    "pnpm view typescript dist-tags --json",
    "pnpm view @typescript/typescript6 version --json",
    "pnpm view typescript-eslint version peerDependencies --json"
  ]
};
writeFileSync("config/dependency-policy.json", `${JSON.stringify(dependencyPolicy, null, 2)}\n`);

replaceOnce(
  "pnpm-workspace.yaml",
  '  "fast-uri@>=3.0.0 <3.1.6": 3.1.6',
  '  "fast-uri@>=3.0.0 <3.1.7": 3.1.7'
);

const aliasAwareDeclaredVersion = `function parseDeclaredVersion(specifier) {
  const text = String(specifier || "").trim();
  const aliasMatch = text.match(/^npm:(?:@[^/]+\\/)?[^@]+@(.+)$/u);
  const versionSpecifier = aliasMatch?.[1] || text;
  const match = versionSpecifier.match(/^(?:\\^|~)?(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)$/u);
  return match ? parseVersion(match[1]) : null;
}`;
replaceRegexOnce(
  "scripts/check-dependencies.mjs",
  /function parseDeclaredVersion\(specifier\) \{[\s\S]*?\n\}/u,
  aliasAwareDeclaredVersion
);

replaceOnce(
  "scripts/check-dependencies.mjs",
  `const typescript = directVersion("typescript");
const typescriptEslint = readInstalledPackage("typescript-eslint");
const typescriptPeerRange = typescriptEslint?.peerDependencies?.typescript;
record(
  "TypeScript and typescript-eslint peer alignment",
  Boolean(typescript && typescriptEslint?.version && satisfiesRange(typescript, typescriptPeerRange)),
  \`typescript \${directSpecifier("typescript")}; typescript-eslint \${
    typescriptEslint?.version || "missing"
  }; peer \${typescriptPeerRange || "missing"}\`
);`,
  `const typescript = directVersion("typescript");
const typescriptCompatInstalled = readInstalledPackage("typescript");
const typescriptNative = directVersion("@typescript/native");
const typescriptNativeInstalled = readInstalledPackage("@typescript/native");
const typescriptEslint = readInstalledPackage("typescript-eslint");
const typescriptPeerRange = typescriptEslint?.peerDependencies?.typescript;
record(
  "TypeScript and typescript-eslint peer alignment",
  Boolean(typescript && typescriptEslint?.version && satisfiesRange(typescript, typescriptPeerRange)),
  \`typescript \${directSpecifier("typescript")}; typescript-eslint \${
    typescriptEslint?.version || "missing"
  }; peer \${typescriptPeerRange || "missing"}\`
);
record(
  "TypeScript 6 API and TypeScript 7 native compiler side-by-side alignment",
  Boolean(
    typescript?.major === 6 &&
      typescriptNative?.major === 7 &&
      typescriptCompatInstalled?.name === "@typescript/typescript6" &&
      parseVersion(typescriptCompatInstalled?.version)?.raw === typescript.raw &&
      typescriptNativeInstalled?.name === "typescript" &&
      parseVersion(typescriptNativeInstalled?.version)?.raw === typescriptNative.raw
  ),
  \`compat \${directSpecifier("typescript")}/\${typescriptCompatInstalled?.version || "missing"}; native \${
    directSpecifier("@typescript/native")
  }/\${typescriptNativeInstalled?.version || "missing"}\`
);`
);

replaceOnce(
  "scripts/dependency-status-policy.mjs",
  `function parseManifestSpecifier(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\\^|~)?(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)$/u);
  if (!match) return null;
  const version = parseVersion(match[2]);
  if (!version) return null;
  return {
    display: text,
    range: \`\${match[1] || ""}\${version.raw}\`,
    version
  };
}`,
  `function parseManifestSpecifier(value) {
  const text = String(value || "").trim();
  const aliasMatch = text.match(/^npm:(?:@[^/]+\\/)?[^@]+@(.+)$/u);
  const versionSpecifier = aliasMatch?.[1] || text;
  const match = versionSpecifier.match(/^(\\^|~)?(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)$/u);
  if (!match) return null;
  const version = parseVersion(match[2]);
  if (!version) return null;
  return {
    display: text,
    range: \`\${match[1] || ""}\${version.raw}\`,
    version
  };
}`
);

replaceOnce(
  "scripts/generate-dependency-status.mjs",
  `function parseDeclaredVersion(specifier) {
  const match = String(specifier || "")
    .trim()
    .match(/^(?:\\^|~)?(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)$/);
  return match ? parseVersion(match[1]) : null;
}`,
  `function parseNpmAlias(specifier) {
  const text = String(specifier || "").trim();
  const match = text.match(/^npm:((?:@[^/]+\\/)?[^@]+)@(.+)$/u);
  return {
    targetName: match?.[1] || "",
    versionSpecifier: match?.[2] || text
  };
}

function parseDeclaredVersion(specifier) {
  const { versionSpecifier } = parseNpmAlias(specifier);
  const match = versionSpecifier.match(/^(?:\\^|~)?(v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?)$/u);
  return match ? parseVersion(match[1]) : null;
}`
);

replaceOnce(
  "scripts/generate-dependency-status.mjs",
  `function directDependencyRows(packageJson) {
  const rows = [];
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, specifier] of Object.entries(packageJson[section] || {})) {
      rows.push({ name, section, specifier, manifestVersion: parseDeclaredVersion(specifier) });
    }
  }
  return rows;
}`,
  `function directDependencyRows(packageJson) {
  const rows = [];
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, specifier] of Object.entries(packageJson[section] || {})) {
      const alias = parseNpmAlias(specifier);
      rows.push({
        name,
        section,
        specifier,
        manifestVersion: parseDeclaredVersion(specifier),
        registryName: name === "@typescript/native" && alias.targetName ? alias.targetName : name
      });
    }
  }
  return rows;
}`
);

replaceOnce(
  "scripts/generate-dependency-status.mjs",
  "async function lookupRegistryMetadata(packageNames, validationKinds = new Map()) {",
  "async function lookupRegistryMetadata(packageNames, validationKinds = new Map(), registryNames = new Map()) {"
);
replaceOnce(
  "scripts/generate-dependency-status.mjs",
  `const results = await mapWithConcurrency(packageNames, REGISTRY_CONCURRENCY, async (name) => {
    try {`,
  `const results = await mapWithConcurrency(packageNames, REGISTRY_CONCURRENCY, async (name) => {
    const registryName = registryNames.get(name) || name;
    try {`
);
replaceOnce(
  "scripts/generate-dependency-status.mjs",
  `await runPnpmAsync(["view", name, "dist-tags.latest", "time", "--json"]),
        \`pnpm view \${name} dist-tags.latest time --json\``,
  `await runPnpmAsync(["view", registryName, "dist-tags.latest", "time", "--json"]),
        \`pnpm view \${registryName} dist-tags.latest time --json\``
);
replaceOnce(
  "scripts/generate-dependency-status.mjs",
  `const directRows = directDependencyRows(packageJson);
  const packageNames = [...new Set(directRows.map((row) => row.name))];`,
  `const directRows = directDependencyRows(packageJson);
  const packageNames = [...new Set(directRows.map((row) => row.name))];
  const registryNames = new Map(directRows.map((row) => [row.name, row.registryName || row.name]));`
);
replaceOnce(
  "scripts/generate-dependency-status.mjs",
  "const registryMetadata = await lookupRegistryMetadata(packageNames, validationKinds);",
  "const registryMetadata = await lookupRegistryMetadata(packageNames, validationKinds, registryNames);"
);

replaceOnce(
  "scripts/dependency-status-policy.test.mjs",
  `  it("rejects a direct dependency behind registry latest", () => {`,
  `  it("accepts a stable npm alias manifest specifier", () => {
    expect(
      classify({
        manifestVersion: "npm:typescript@1.0.2",
        installedVersion: "1.0.2",
        registryLatest: "1.0.2"
      })
    ).toEqual({
      status: DEPENDENCY_STATUS.registryLatest,
      reason: "Installed version matches the stable registry latest.",
      registryLatest: "1.0.2"
    });
  });

  it("rejects a direct dependency behind registry latest", () => {`
);

console.log("Applied TypeScript 7 side-by-side migration source changes.");
