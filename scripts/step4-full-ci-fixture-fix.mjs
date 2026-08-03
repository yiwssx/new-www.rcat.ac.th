import fs from "node:fs";

function patch(file, from, to) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) {
    throw new Error(`Missing expected fixture in ${file}`);
  }
  fs.writeFileSync(file, source.replace(from, to));
}

patch(
  "src/test/publicDataDrivenPages.test.tsx",
  `    expect(screen.getByText("Award result 13")).toBeInTheDocument();\n    expect(screen.getByText("Award result 2")).toBeInTheDocument();\n    expect(screen.queryByText("Award result 1")).not.toBeInTheDocument();`,
  `    expect(screen.getByText("Award result 1")).toBeInTheDocument();\n    expect(screen.getByText("Award result 12")).toBeInTheDocument();\n    expect(screen.queryByText("Award result 13")).not.toBeInTheDocument();`
);

patch(
  "src/public/hooks/usePublicContentDetail.test.tsx",
  `        new Response(JSON.stringify({ item: content }), {\n          status: 200,\n          headers: { "Content-Type": "application/json" }\n        })`,
  `        new Response(JSON.stringify({ item: content, media: [], generatedAt: content.updatedAt }), {\n          status: 200,\n          headers: { "Content-Type": "application/json" }\n        })`
);

console.log("Step 4 full-CI fixtures aligned with Worker-owned search and detail media contracts.");
