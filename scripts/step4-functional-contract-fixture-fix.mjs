import fs from "node:fs";

function patch(file, from, to) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(from)) {
    throw new Error(`Missing expected fixture source in ${file}: ${from.slice(0, 120)}`);
  }
  fs.writeFileSync(file, source.replace(from, to));
}

patch(
  "tests/functional/fixtures/publicShellClsFixture.ts",
  `    summary: "Deterministic content used to reserve realistic Public route geometry.",\n    body: "Deterministic body paragraph one.\\n\\nDeterministic body paragraph two.\\n\\nDeterministic body paragraph three.",\n    category: "Layout",`,
  `    summary: "Deterministic content used to reserve realistic Public route geometry.",\n    category: "Layout",`
);

patch(
  "tests/functional/fixtures/publicShellClsFixture.ts",
  `  title: "Deterministic layout stability content detail",\n  template: "standard",`,
  `  title: "Deterministic layout stability content detail",\n  body: "Deterministic body paragraph one.\\n\\nDeterministic body paragraph two.\\n\\nDeterministic body paragraph three.",\n  template: "standard",`
);

patch(
  "tests/functional/fixtures/publicShellClsFixture.ts",
  `    if (url.pathname === "/api/public/home") {\n      await fulfillJson(route, 200, homeSnapshot);\n      return;\n    }`,
  `    if (url.pathname === "/api/public/home") {\n      await fulfillJson(route, 200, homeSnapshot);\n      return;\n    }\n\n    if (url.pathname === "/api/public/shell") {\n      await fulfillJson(route, 200, shellFields);\n      return;\n    }`
);

patch(
  "tests/functional/fixtures/publicShellClsFixture.ts",
  `    if (url.pathname === "/api/public/search") {\n      await fulfillJson(route, 200, {\n        items: [...newsItems, ...programItems],\n        ...shellFields\n      });`,
  `    if (url.pathname === "/api/public/search") {\n      await fulfillJson(route, 200, {\n        query: url.searchParams.get("q")?.trim() || "",\n        items: [...newsItems, ...programItems],\n        ...shellFields\n      });`
);

patch(
  "tests/functional/fixtures/publicShellClsFixture.ts",
  `      await fulfillJson(route, 200, { item: detailItem, generatedAt });`,
  `      await fulfillJson(route, 200, { item: detailItem, media: [], generatedAt });`
);

patch(
  "tests/functional/fixtures/publicAuthIsolationFixture.ts",
  `  summary: "A deterministic news item for the Public route contract.",\n  body: "The Public news fixture rendered successfully.",\n  category: "Functional",`,
  `  summary: "A deterministic news item for the Public route contract.",\n  category: "Functional",`
);

patch(
  "tests/functional/fixtures/publicAuthIsolationFixture.ts",
  `    latestNews: [newsItem, contentItem],`,
  `    latestNews: [newsItem],`
);

patch(
  "tests/functional/fixtures/publicAuthIsolationFixture.ts",
  `    if (url.pathname === "/api/public/home") {\n      payload = homeSnapshot;\n    } else if (url.pathname === "/api/public/content"`,
  `    if (url.pathname === "/api/public/home") {\n      payload = homeSnapshot;\n    } else if (url.pathname === "/api/public/shell") {\n      payload = {\n        siteSettings: homeSnapshot.siteSettings,\n        homepageSettings: homeSnapshot.homepageSettings,\n        displaySettings: homeSnapshot.displaySettings,\n        menu: homeSnapshot.menu,\n        generatedAt\n      };\n    } else if (url.pathname === "/api/public/content"`
);

patch(
  "tests/functional/fixtures/publicAuthIsolationFixture.ts",
  `      payload = { item: contentItem, generatedAt };`,
  `      payload = { item: contentItem, media: [], generatedAt };`
);

patch(
  "tests/functional/publicMediaPerformance.spec.ts",
  `    if (url.pathname === "/api/public/home") {\n      payload = snapshot;\n    } else if (url.pathname === "/api/public/content"`,
  `    if (url.pathname === "/api/public/home") {\n      payload = snapshot;\n    } else if (url.pathname === "/api/public/shell") {\n      payload = {\n        siteSettings: snapshot.siteSettings,\n        homepageSettings: snapshot.homepageSettings,\n        displaySettings: snapshot.displaySettings,\n        menu: snapshot.menu,\n        generatedAt\n      };\n    } else if (url.pathname === "/api/public/content"`
);

patch(
  "tests/functional/publicMediaPerformance.spec.ts",
  `      payload = { item: detailItem, generatedAt };`,
  `      payload = { item: detailItem, media, generatedAt };`
);

console.log("Step 4 functional fixtures aligned with summary/detail/search/shell contracts.");
