# Public Shell and Footer CLS Stability

## Scope

- Starting master: `fef177a8719a760f63591a7762ea57ffe3326386`
- Measurement date: 2026-07-28
- Viewports: desktop `1280x720`, mobile `390x844`
- Test browser: the repository's Playwright Chromium

This change stabilizes the existing CMS-driven Public shell. It does not change
the Footer Directory data contract, links, order, design, Public API, Worker,
authentication, or Admin runtime.

## Root cause

The high shift was not caused only by the Footer Directory. It was the visible
downstream result of three related lifecycle problems:

1. Each Public page owned a separate `PublicSiteShell`, so route transitions
   replaced the shell and its data lifecycle instead of retaining one route-level
   shell.
2. Fallback site settings contained no Footer Directory groups. While data was
   pending, `FooterDirectory` therefore returned `null`; after the response it
   inserted the complete four-column directory into normal flow.
3. The former loading state reserved only a thin progress bar and small padding.
   Large listing, grid, search, and detail bodies then expanded after the response,
   pushing both footer regions down by roughly 1,500–4,600 px in the deterministic
   cases.

The pending navigation row and unknown detail-page heading also had no stable
reservation. Font settlement contributed only to the remaining small shell/main
movement. The fixed messenger control, images, and embeds were not material
contributors to the measured footer-flow shift.

## Data and render lifecycle

### Before

- Page components mounted and remounted their own shell.
- The shell began with fallback settings and an empty directory.
- Route queries later supplied the same shell fields independently.
- Loading and error branches could substitute short, differently sized content.
- A background request could expose loading behavior even when usable data was
  already cached.

### After

- `PublicShellRouteLayout` owns one persistent `PublicSiteShell` around the Public
  route outlet.
- The outer shell owns the shared Public CMS snapshot. Nested page shell calls
  register route title, header, and preloaded shell fields without adding another
  shell DOM tree.
- Route-provided CMS fields seed or override the shell immediately when available;
  retained valid shell data does not flash back to defaults.
- Ready route children mount only after the outer shell accepts the same
  registration object. This closes the one-frame loading-to-ready gap so Intro
  Gate settings are active before Home carousel or page media can request assets.
- Auth and Admin routes remain outside this lazy Public layout and do not request
  Public shell data.
- Public telemetry remains lazy and Public-only.

The shell now stays mounted during uncached and cached route navigation. Normal
React Query invalidation remains intact, and existing route results remain visible
during background refetch.

## Footer Directory lifecycle

- **Pending:** a non-interactive, `aria-hidden` placeholder reserves realistic
  heading and row geometry. It uses four desktop columns, two tablet columns, and
  one mobile column.
- **Ready:** the existing enabled CMS groups and safe links render in their
  original order. The outer region keeps the same layout contract.
- **Empty:** the resolved marker has zero geometry, so an intentionally disabled
  directory does not leave a permanent blank region.

The states are observable through `data-cls-region="footer-directory"` and
`data-footer-directory-state="loading|ready|empty"`. Placeholder content contains
no anchors, buttons, or other focusable controls.

## Route loading, refetch, and errors

`PublicLoadingState` now provides structured variants for listings, card grids,
search results, content details, home, and simple pages. The skeleton structure
reserves responsive page geometry rather than relying on a progress bar alone.
It exposes one semantic loading status, contains no fake interactive content, and
honors reduced motion.

Background refetch retains the ready route and directory. A constant-height
progress slot reports activity without moving the dark footer; the isolated
refetch fixture measured CLS `0.000183` and `0 px` dark-footer movement.

Recoverable route errors render inside the same shell with accessible retry UI.
The deterministic error fixture measured CLS `0.016333`. A resolved empty
directory collapses without a permanent gap and measured CLS `0.014986`.

## Deterministic measurement

The Playwright fixture intercepts only local `/api/public/**` requests and supplies
complete site settings, four seven-link directory groups, homepage settings,
menu, News, Search, Departments, and Content Detail data. Responses can be held
and released deterministically.

An init script installs a `PerformanceObserver` before application scripts run.
It records layout-shift entries without recent input, source regions, and start
times. Helpers calculate cumulative shift, group source regions, reset between
navigations, wait for a quiet layout window, and capture bounding boxes for main,
loading, directory, dark footer, messenger, and document height. Direct-load tests
record the pending phase, the first resolved frame, and the settled frame.

Baseline values were captured from an isolated worktree at the starting commit
using the same production build, Chromium, fixtures, viewports, and observer.
No production services were contacted.

## CLS results

| Scenario                           | Starting commit | Corrected | Budget |
| ---------------------------------- | --------------: | --------: | -----: |
| Desktop News direct load           |        0.846890 |  0.017050 |  < 0.1 |
| Mobile News direct load            |        1.469000 |  0.058010 |  < 0.1 |
| Desktop Search direct load         |        0.847000 |  0.018139 |  < 0.1 |
| Desktop Departments direct load    |        0.847000 |  0.017649 |  < 0.1 |
| Desktop Content Detail direct load |        0.782000 |  0.038213 |  < 0.1 |
| Uncached Public route navigation   |        0.702512 |  0.001160 |  < 0.1 |
| Cached return navigation           |        0.000000 |  0.000000 | < 0.02 |
| Background refetch                 |    not isolated |  0.000183 | < 0.02 |
| Resolved empty directory           |    not isolated |  0.014986 |  < 0.1 |
| Recoverable API error              |    not isolated |  0.016333 |  < 0.1 |

The starting cached return happened to measure zero CLS, but it still replaced
the shell DOM. The corrected path retains the same shell element on both uncached
and cached navigation.

## Direct-load geometry

`pending → ready` values are CSS pixels. A missing baseline directory means it was
inserted only after the API response.

| Scenario                         | Directory present pending (before → after) |       Directory top |    Directory height |     Dark-footer top | Document height |
| -------------------------------- | ------------------------------------------ | ------------------: | ------------------: | ------------------: | --------------: |
| Baseline Desktop News            | no → yes                                   |   absent → 2064.922 |    absent → 302.484 |  288.765 → 2383.406 |      720 → 2500 |
| Corrected Desktop News           | loading → ready                            | 2133.828 → 2094.922 |   302.000 → 302.484 | 2451.828 → 2413.406 |     2569 → 2530 |
| Baseline Mobile News             | no → yes                                   |   absent → 3897.797 |   absent → 1051.250 |  332.375 → 4965.047 |      844 → 5180 |
| Corrected Mobile News            | loading → ready                            | 3957.750 → 3941.594 | 1051.000 → 1051.250 | 5024.750 → 5008.844 |     5240 → 5224 |
| Baseline Desktop Search          | no → yes                                   |   absent → 2268.672 |    absent → 302.484 |  288.765 → 2587.156 |      720 → 2704 |
| Corrected Desktop Search         | loading → ready                            | 2333.828 → 2298.672 |   302.000 → 302.484 | 2651.828 → 2617.156 |     2769 → 2734 |
| Baseline Desktop Departments     | no → yes                                   |   absent → 1611.656 |    absent → 302.484 |  288.765 → 1930.140 |      720 → 2047 |
| Corrected Desktop Departments    | loading → ready                            | 1683.828 → 1641.656 |   302.000 → 302.484 | 2001.828 → 1960.141 |     2119 → 2077 |
| Baseline Desktop Content Detail  | no → yes                                   |   absent → 1471.438 |    absent → 302.484 |  257.765 → 1789.922 |      720 → 1907 |
| Corrected Desktop Content Detail | loading → ready                            | 1484.766 → 1474.438 |   302.000 → 302.484 | 1802.766 → 1792.922 |     1920 → 1910 |

Corrected absolute directory-top movement was `38.906 px` for Desktop News,
`16.156 px` for Mobile News, `35.156 px` for Search, `42.172 px` for
Departments, and `10.328 px` for Content Detail. Corresponding dark-footer
movement was `38.422 px`, `15.906 px`, `34.672 px`, `41.688 px`, and
`9.844 px`. Directory-height delta stayed at or below `0.484 px`.

By comparison, the baseline dark footer moved about `2094.641 px` for Desktop
News, `4632.672 px` for Mobile News, `2298.391 px` for Search, `1641.375 px`
for Departments, and `1532.157 px` for Content Detail.

## Startup performance

The committed startup limits were not raised.

| Build              | Raw synchronous startup | Gzip synchronous startup |
| ------------------ | ----------------------: | -----------------------: |
| Starting commit    |           375,728 bytes |            123,576 bytes |
| Corrected          |           375,137 bytes |            123,325 bytes |
| Committed limit    |           388,000 bytes |            127,000 bytes |
| Corrected headroom |            12,863 bytes |              3,675 bytes |

The corrected synchronous startup is 591 raw bytes and 251 gzip bytes smaller
than the starting build. The public-only lazy layout keeps its route skeleton and
telemetry graph outside unrelated Auth/Admin startup paths.

## Regression governance

`pnpm layout:check` is dependency-free and is part of `pnpm quality` and the CI
quality job. Its syntax-aware checks protect the stable directory states,
non-focusable placeholder, structured loading variants, functional CLS budget,
Public/Auth import boundary, route-level shell ownership, and ready-content
retention. Dedicated governance unit tests prove representative regressions fail.

Existing `pnpm perf:check` and `pnpm media:check` remain unchanged.

## Limitations

These are local deterministic Chromium CLS measurements, not production field
CLS. No Lighthouse score or Chrome UX Report claim is made. Production font
delivery, browser extensions, third-party widgets, device rendering, viewport
distribution, and network conditions can introduce additional shifts. The fixture
does not establish real-user percentiles; production Web Vitals telemetry is
still required to validate the field outcome after normal release.
