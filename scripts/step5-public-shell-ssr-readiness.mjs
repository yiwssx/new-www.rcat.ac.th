import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Missing expected source for ${label}`);
  }

  return source.replace(from, to);
}

function updateFile(path, transform) {
  const current = readFileSync(path, "utf8");
  const next = transform(current);

  if (current === next) {
    throw new Error(`No changes produced for ${path}`);
  }

  writeFileSync(path, next);
}

updateFile("src/public/components/PublicSiteShell.tsx", (source) => {
  let next = source;

  next = replaceOnce(next, "  useContext,\n  useLayoutEffect,\n  useMemo,", "  useContext,\n  useEffect,\n  useMemo,", "React effect import");
  next = replaceOnce(
    next,
    'import { PublicMediaLoadingProvider } from "../../shared/media/PublicMediaLoadingContext";\n',
    'import { PublicMediaLoadingProvider } from "../../shared/media/PublicMediaLoadingContext";\nimport { usePublicShellSnapshot } from "../hooks/usePublicShellSnapshot";\n',
    "public shell snapshot hook import"
  );
  next = replaceOnce(
    next,
    'import { usePublicCmsSnapshot } from "../hooks/usePublicCmsSnapshot";\n',
    "",
    "legacy shell snapshot hook import"
  );
  next = replaceOnce(
    next,
    "interface PublicSiteShellRegistrationController {\n  activeRegistration: PublicSiteShellRegistration | null;\n  register: (registration: PublicSiteShellRegistration) => void;\n",
    "interface PublicSiteShellRegistrationController {\n  register: (registration: PublicSiteShellRegistration) => void;\n",
    "registration controller active state"
  );
  next = replaceOnce(
    next,
    '    "/": {\n      hidePageHeader: true,\n      disableMainContainer: true,\n      skipShellDataFetch: true\n    },',
    '    "/": {\n      hidePageHeader: true,\n      disableMainContainer: true\n    },',
    "home route shell ownership"
  );
  next = replaceOnce(next, "  useLayoutEffect(() => {\n", "  useEffect(() => {\n", "non-blocking registration effect");
  next = replaceOnce(
    next,
    "  return controller?.activeRegistration === registration ? <>{children}</> : null;\n",
    "  return <>{children}</>;\n",
    "nested shell first-pass rendering"
  );
  next = replaceOnce(
    next,
    "  const registrationController = useMemo(\n    () => ({\n      activeRegistration: registeredPage,\n      register,\n      unregister\n    }),\n    [register, registeredPage, unregister]\n  );\n",
    "  const registrationController = useMemo(\n    () => ({\n      register,\n      unregister\n    }),\n    [register, unregister]\n  );\n",
    "stable registration controller"
  );
  next = replaceOnce(
    next,
    "  const { data, isLoading, isFetching, isError, refetch } = usePublicCmsSnapshot({\n    enabled: shouldFetchShellData\n  });\n",
    "  const { data, isLoading, isFetching, isError, refetch } = usePublicShellSnapshot({\n    enabled: shouldFetchShellData\n  });\n",
    "lightweight public shell hook"
  );

  return next;
});

writeFileSync(
  "src/public/hooks/usePublicShellSnapshot.ts",
  `import { useQuery } from "@tanstack/react-query";\nimport { publicShellQueryOptions } from "../../features/public-shell";\n\ninterface UsePublicShellSnapshotOptions {\n  enabled?: boolean;\n}\n\nexport function usePublicShellSnapshot(options: UsePublicShellSnapshotOptions = {}) {\n  const enabled = options.enabled ?? true;\n\n  return useQuery({\n    ...publicShellQueryOptions({ consumeAbortSignal: false }),\n    enabled\n  });\n}\n`
);

updateFile("src/test/publicDataDrivenPages.test.tsx", (source) =>
  replaceOnce(
    source,
    'vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({\n  usePublicCmsSnapshot: (options?: { enabled?: boolean }) => {\n    usePublicCmsSnapshotMock(options);\n\n    return {\n      data: currentSnapshot,\n      ...currentQueryState\n    };\n  }\n}));\n',
    'vi.mock("../public/hooks/usePublicCmsSnapshot", () => ({\n  usePublicCmsSnapshot: (options?: { enabled?: boolean }) => {\n    usePublicCmsSnapshotMock(options);\n\n    return {\n      data: currentSnapshot,\n      ...currentQueryState\n    };\n  }\n}));\n\nvi.mock("../public/hooks/usePublicShellSnapshot", () => ({\n  usePublicShellSnapshot: (options?: { enabled?: boolean }) => {\n    usePublicCmsSnapshotMock(options);\n\n    return {\n      data: currentSnapshot,\n      ...currentQueryState\n    };\n  }\n}));\n',
    "public shell hook test boundary"
  )
);

updateFile("src/test/publicShellLayoutStability.test.tsx", (source) =>
  replaceOnce(
    source,
    '    expect(publicSiteShellSource).toContain("PublicSiteShellRegistrationContext.Provider");\n    expect(publicSiteShellSource).toContain("RegisteredPublicSiteShell");\n    expect(publicSiteShellSource).toContain("useLayoutEffect");\n',
    '    expect(publicSiteShellSource).toContain("PublicSiteShellRegistrationContext.Provider");\n    expect(publicSiteShellSource).toContain("RegisteredPublicSiteShell");\n    expect(publicSiteShellSource).toContain("return <>{children}</>;");\n    expect(publicSiteShellSource).not.toContain("activeRegistration === registration");\n    expect(publicSiteShellSource).not.toContain("useLayoutEffect");\n',
    "first-pass shell ownership contract"
  )
);

updateFile("tests/functional/fixtures/publicHomeCarouselFixture.ts", (source) =>
  replaceOnce(
    source,
    '  await page.route("**/api/public/home", async (route) => {\n    await route.fulfill({\n      status: 200,\n      contentType: "application/json",\n      body: JSON.stringify(createPublicHomeSnapshot(options))\n    });\n  });\n\n',
    '  await page.route("**/api/public/home", async (route) => {\n    await route.fulfill({\n      status: 200,\n      contentType: "application/json",\n      body: JSON.stringify(createPublicHomeSnapshot(options))\n    });\n  });\n\n  await page.route("**/api/public/shell", async (route) => {\n    const snapshot = createPublicHomeSnapshot(options);\n\n    await route.fulfill({\n      status: 200,\n      contentType: "application/json",\n      body: JSON.stringify({\n        siteSettings: snapshot.siteSettings,\n        homepageSettings: snapshot.homepageSettings,\n        displaySettings: snapshot.displaySettings,\n        menu: snapshot.menu,\n        generatedAt: snapshot.generatedAt\n      })\n    });\n  });\n\n',
    "home carousel shell endpoint fixture"
  )
);

updateFile("tests/functional/publicIntroGate.spec.ts", (source) =>
  replaceOnce(
    source,
    '  await page.route("**/api/public/home", async (route) => {\n    await route.fulfill({\n      status: 200,\n      contentType: "application/json",\n      body: JSON.stringify(createIntroSnapshot())\n    });\n  });\n\n',
    '  await page.route("**/api/public/home", async (route) => {\n    await route.fulfill({\n      status: 200,\n      contentType: "application/json",\n      body: JSON.stringify(createIntroSnapshot())\n    });\n  });\n\n  await page.route("**/api/public/shell", async (route) => {\n    const snapshot = createIntroSnapshot();\n\n    await route.fulfill({\n      status: 200,\n      contentType: "application/json",\n      body: JSON.stringify({\n        siteSettings: snapshot.siteSettings,\n        homepageSettings: snapshot.homepageSettings,\n        displaySettings: snapshot.displaySettings,\n        menu: snapshot.menu,\n        generatedAt: snapshot.generatedAt\n      })\n    });\n  });\n\n',
    "intro gate shell endpoint fixture"
  )
);

updateFile("tests/functional/publicShellClsStability.spec.ts", (source) =>
  replaceOnce(
    source,
    "    fixture.release();\n    await waitForReadyText(page, layoutCase.readyText);\n",
    "    fixture.release();\n    await waitForReadyText(page, layoutCase.readyText);\n\n    if (layoutCase.name === \"desktop-news\") {\n      expect(fixture.requests.filter((request) => request === \"/api/public/shell\")).toHaveLength(1);\n      expect(fixture.requests.filter((request) => request === \"/api/public/home\")).toHaveLength(0);\n    }\n",
    "lightweight shell functional assertion"
  )
);

writeFileSync(
  "src/test/publicSiteShellSsrReadiness.test.ts",
  `import publicSiteShellSource from "../public/components/PublicSiteShell.tsx?raw";\nimport publicShellHookSource from "../public/hooks/usePublicShellSnapshot.ts?raw";\nimport { describe, expect, it } from "vitest";\n\ndescribe("PublicSiteShell SSR readiness", () => {\n  it("renders nested page content independently of client registration effects", () => {\n    expect(publicSiteShellSource).toContain("return <>{children}</>;");\n    expect(publicSiteShellSource).not.toContain("activeRegistration === registration");\n    expect(publicSiteShellSource).not.toContain("useLayoutEffect");\n  });\n\n  it("makes the route shell own the lightweight public shell query through a testable hook boundary", () => {\n    expect(publicSiteShellSource).toContain("usePublicShellSnapshot({");\n    expect(publicSiteShellSource).not.toContain("usePublicCmsSnapshot({");\n    expect(publicSiteShellSource).not.toContain("skipShellDataFetch: true");\n    expect(publicShellHookSource).toContain("publicShellQueryOptions({ consumeAbortSignal: false })");\n  });\n});\n`
);

updateFile("docs/architecture/current-runtime-ownership.md", (source) =>
  replaceOnce(
    source,
    "These readiness changes do not enable server rendering, hydration, route loaders, server-side metadata, canonical redirects, or the Step 5 PublicSiteShell refactor. Those remain separate migration stages and must preserve the existing Public/Admin runtime boundaries.\n",
    "Step 5 makes the route-level PublicSiteShell the authoritative shell renderer. Nested page-level PublicSiteShell instances now render their children on the first render pass and no longer gate page HTML on a client registration effect. Their remaining registration is a client-side enhancement for page-specific metadata and preloaded shell props only; it is not required for page-content rendering. The route shell now reads the lightweight /api/public/shell query through a dedicated Public shell hook, including on the home route, instead of depending on a child page effect to provide settings/menu data. This keeps shell ownership compatible with a future server render while preserving the current CSR deployment and a testable data-hook boundary.\n\nThese readiness changes still do not enable server rendering, hydration, route loaders, server-side metadata/head generation, canonical redirects, or Vercel SSR routing. The remaining client metadata registration is intentionally temporary until the later route-head/SEO step replaces it with server-visible metadata ownership.\n",
    "Step 5 runtime ownership documentation"
  )
);

console.log("Step 5 PublicSiteShell SSR-readiness patch applied.");
