from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    if old not in content:
        raise SystemExit(f"marker not found in {path}: {old[:120]!r}")
    file_path.write_text(content.replace(old, new, 1), encoding="utf-8")


# Replace raw public <img> with a Tailwind-only ITA emblem to comply with media governance.
replace_once(
    "src/public/pages/PublicIta2569Page.tsx",
    '''            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-4 ring-white/15">\n              <img src="/rcat-logo-128.png" alt="ตราวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด" width={64} height={64} />\n            </div>''',
    '''            <div\n              aria-label="ITA 2569"\n              className="mx-auto mb-5 flex h-20 w-20 flex-col items-center justify-center rounded-2xl border border-white/30 bg-white/10 shadow-lg ring-4 ring-white/10 backdrop-blur"\n            >\n              <span className="text-xl font-black leading-none text-amber-200">ITA</span>\n              <span className="mt-1 text-xs font-extrabold tracking-wider text-white">2569</span>\n            </div>'''
)

# Lazy-load the custom public page.
replace_once(
    "src/routeComponents.tsx",
    'export const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));\nexport const PublicNewsPage',
    'export const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));\nexport const PublicIta2569Page = lazy(() => import("./public/pages/PublicIta2569Page"));\nexport const PublicNewsPage'
)

# Register /ita2569 before the generic public permalink route.
replace_once(
    "src/routes.tsx",
    '  PublicHomePage,\n  PublicNewsPage,',
    '  PublicHomePage,\n  PublicIta2569Page,\n  PublicNewsPage,'
)
replace_once(
    "src/routes.tsx",
    '''const publicSearchRoute = createRoute({\n  getParentRoute: () => publicLayoutRoute,''',
    '''const publicIta2569Route = createRoute({\n  getParentRoute: () => publicLayoutRoute,\n  path: "ita2569",\n  head: () =>\n    buildPublicRouteHead({\n      title: "ITA ประจำปีงบประมาณ พ.ศ. 2569",\n      description:\n        "การเปิดเผยข้อมูลสาธารณะ (OIT) เพื่อการประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ประจำปีงบประมาณ พ.ศ. 2569",\n      canonicalPath: "/ita2569"\n    }),\n  component: PublicIta2569Page\n});\n\nconst publicSearchRoute = createRoute({\n  getParentRoute: () => publicLayoutRoute,'''
)
replace_once(
    "src/routes.tsx",
    '''    publicContactRoute,\n    publicComplaintRoute,\n    publicSearchRoute,''',
    '''    publicContactRoute,\n    publicComplaintRoute,\n    publicIta2569Route,\n    publicSearchRoute,'''
)

# Make the static ITA page discoverable in the runtime sitemap.
replace_once(
    "api/sitemap.mjs",
    '  "/calendar",\n  "/contact"\n];',
    '  "/calendar",\n  "/contact",\n  "/ita2569"\n];'
)

# Explicit regression coverage for sitemap registration.
replace_once(
    "src/test/sitemap.test.mjs",
    '''    expect(urls).toContain("https://school.example/content/published-news");''',
    '''    expect(STATIC_INDEXABLE_ROUTES).toContain("/ita2569");\n    expect(urls).toContain("https://school.example/ita2569");\n    expect(urls).toContain("https://school.example/content/published-news");'''
)
