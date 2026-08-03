# Public media performance

## Scope and measurement

- Starting master: `c34c8c1c6269e50fac8307b5cbf6ec999138c97c`
- Corrected snapshot: working tree on `perf/public-media-performance`, measured before the final commit on 2026-07-28
- Browser: repository Playwright Chromium project
- Viewports: mobile 390 × 844, desktop 1440 × 900, content detail 1280 × 720
- Baseline: detached worktree at the starting master SHA
- Corrected suite: `tests/functional/publicMediaPerformance.spec.ts`

Both runs intercepted the Public API plus Google Drive, YouTube, and Facebook. They did not contact production services. Every media role used a distinct fixture ID: Intro Gate, five desktop and five mobile Carousel images, director, regular and featured cards, program card, content featured image, two body images, video, Facebook post, and event attachment. The committed local logo remained `/rcat-logo-128.png`.

Each intercepted image response is the same documented 120-byte SVG body. Request counts and selected `sz=wNNN` candidates are therefore deterministic, but the fixture does not represent production image bytes. Local timings are not production LCP, CLS, Web Vitals, or transfer-size measurements.

### Step 6 SSR-readiness note

The request-count tables in this document are historical measurements from the 2026-07-28 media-performance pass. SSR-readiness Step 6 changes the current semantic-image policy: a normal Public `near-viewport` image now exists as an `<img>` in the first render tree and relies on native `loading="lazy"` with low fetch priority instead of withholding `src`/`srcSet` behind an IntersectionObserver. This is required so future server-rendered HTML contains meaningful image elements and does not hydrate from a placeholder-only tree.

The Public page-media gate remains authoritative. While an enabled Intro Gate owns critical priority, ordinary page images may still be source-gated by the surrounding media-loading context. Carousel distant-slide request windows remain separately controlled by `CarouselImageStage.shouldLoad`. Heavy iframe/embed resources continue to use explicit near-viewport activation because their network/runtime cost is materially higher and their iframe element is not required as semantic image content.

The historical request-count tables below must not be presented as a fresh post-Step-6 measurement until the focused browser media suite is rerun against the Step 6 branch. Governance and SSR determinism tests, rather than those historical numbers, define the current repository contract during this readiness stage.

## Corrective review note

Review of the initial branch found that `PublicResponsiveImage` could place an
absolutely positioned fill image inside a wrapper that did not inherit the
fixed card slot height. The shared fill wrapper now defaults to
`height: 100%`, while caller `sx` remains later in the style order and can
override that default. Browser-level bounding-box assertions prove that the
regular card slot and image are both 70 × 70 px and the desktop featured card
slot and image are both 180 × 150 px.

`MediaAsset` precedence now means the first valid and usable candidate. Each
candidate is normalized and checked in order, so unsafe resources, Facebook
CDN URLs, and Drive URLs without a valid file ID fall through to the next
candidate. The deterministic invalid-thumbnail fixture confirms that a valid
preview is selected and remains visible at the regular-card `w160` candidate.
The corrected request-budget counts and candidate tables below are unchanged
by this pass.

## Architecture

`src/shared/media/publicImageSources.ts` is the single Public image source policy. It owns safe normalization, Drive ID extraction, Drive thumbnail generation, source precedence, intent widths, fallback widths, `srcSet` construction, and width normalization.

`PublicResponsiveImage` is the normal Public renderer. Its modes are:

- `critical`: assigns `loading="eager"` and `fetchpriority="high"`;
- `eager`: assigns eager loading with automatic priority;
- `near-viewport`: renders the semantic image on the first pass with native `loading="lazy"` and low fetch priority. The browser decides when to fetch the resource; React does not swap a source-free placeholder into an image after hydration.

The surrounding Public page-media gate may still withhold a page image while Intro Gate state is unresolved or visible. Load failure replaces the network-bearing image with an accessible fallback.

`PublicDeferredEmbed` keeps explicit near-viewport activation for iframes. The iframe element and its `src` do not exist before activation. It retains title, allow, fullscreen, referrer policy, scrolling, native width/height, and a stable wrapper.

### Image intent matrix

| Intent             | Drive candidates          | Fallback `src` | Typical slot                            |
| ------------------ | ------------------------- | -------------: | --------------------------------------- |
| `logo`             | 128                       |            128 | intrinsic 128 × 128 local logo          |
| `tiny-thumbnail`   | 160, 240, 320, 480        |            240 | small list thumbnails                   |
| `content-card`     | 160, 240, 320, 480, 640   |            320 | 70 px regular card                      |
| `featured-card`    | 320, 480, 640, 900        |            640 | full-width mobile / 180 px desktop card |
| `hero`             | 480, 640, 900, 1200       |            900 | CMS hero background                     |
| `portrait`         | 192, 256, 384, 512        |            384 | 160–192 px, 3:4 director portrait       |
| `event-attachment` | 320, 480, 640, 900        |            640 | event dialog attachment                 |
| `content-body`     | 480, 640, 900, 1200, 1600 |           1200 | uncropped content image                 |
| `content-featured` | 480, 640, 900, 1200, 1600 |           1600 | large detail feature                    |
| `carousel`         | 480, 640, 900, 1200, 1600 |           1600 | responsive Carousel stage               |
| `intro-gate`       | 480, 640, 900, 1200, 1600 |           1600 | viewport-scale Intro Gate               |

All widths must be sorted, unique, positive integers no greater than 1600. Small intents must contain a candidate below 640 and must not fall back to 1600.

### MediaAsset source precedence

- Small/card/list intents: `thumbnailUrl`, then `previewUrl`, then `driveUrl`.
- Large detail/content intents: `previewUrl`, then `driveUrl`, then `thumbnailUrl`.

Local paths are unchanged. Safe arbitrary HTTPS images remain usable without fabricated variants. Unsafe resource URLs, invalid Drive IDs, and direct Facebook CDN images remain rejected.

## Critical priority ownership

- Home with Intro Gate visible: the Intro image is the sole high-priority image. The page-media context blocks the Carousel and all other Public media.
- Home after dismissal, or with the gate disabled/dismissed: the selected Carousel image becomes the sole high-priority content image without reloading the page.
- Feature content detail: the above-fold featured image owns high priority.
- Update layouts, listings, content blocks, director, cards, hero, event attachments, and embeds do not use high priority.
- The local logo preserves normal eager loading and explicit 128 × 128 intrinsic dimensions, but never receives high priority or a preload.

## Carousel request window

Every structural slide wrapper remains mounted for the interactive Carousel after client enhancement, preserving Embla/fade transitions, announcements, and accessibility. Before enhancement, the Step 6 SSR boundary renders one deterministic active slide from the snapshot reference time. Only requested interactive slides receive a picture/image source:

1. the deterministic first-pass selected slide may load when page media is allowed;
2. after the interactive Carousel mounts, its selected slide loads immediately;
3. after that foreground loads, the next slide may preload during idle time at automatic priority;
4. a navigation action requests its destination before/as selection changes;
5. a newly selected, already-loaded slide may then schedule its next neighbor;
6. distant interactive slides retain source-free placeholders.

The loaded-slide set prevents a non-selected preload from cascading through all five slides. Loop indexes, arrows, dots, keyboard controls, swipe, autoplay, pause rules, schedule visibility, desktop/mobile variants, focal points, and fit modes remain intact after the client enhancement boundary activates.

For `fit-blur`, the decorative background is drawn to a canvas from the already-loaded foreground image. It is `aria-hidden`, appears only after foreground load, and does not create a second image URL or request.

## Layout stability

- Logo: native width/height 128 with a fixed visual wrapper.
- Regular/featured cards: fixed 70 px or responsive 150 px slots.
- Carousel: existing fixed responsive stage heights on both the deterministic boundary and enhanced Carousel.
- Director: fixed 3:4 aspect ratio.
- Intro Gate: fixed loading/failure slot.
- Hero: fixed section height with a fill layer.
- Event attachments: 4:3 grid slots.
- Videos/Facebook/maps: fixed-height deferred wrappers.
- Body/detail images: reserved minimum height without forcing an unknown crop ratio.

No production CLS value is claimed.

## Baseline versus corrected requests

The counts below are the historical 2026-07-28 intercepted external fixture requests. They have not yet been re-measured after the Step 6 semantic-image policy change. “Initial” in this historical table includes the allowed idle next-slide preload where applicable.

| Scenario                                                     | Baseline | Corrected |
| ------------------------------------------------------------ | -------: | --------: |
| Mobile Home, Intro visible: total Drive image requests       |        9 |         1 |
| Mobile Home, Intro visible: unique Drive image requests      |        9 |         1 |
| Carousel requests before Intro dismissal                     |        5 |         0 |
| High-priority images before Intro dismissal                  |        2 |         1 |
| Eager images before Intro dismissal                          |        3 |         1 |
| Desktop Home without Intro: total/unique Drive requests      |    8 / 8 |     3 / 3 |
| Five-slide Carousel initial unique slide requests            |        5 |         2 |
| Carousel cumulative unique slides after one Next             |        5 |         3 |
| Newly requested slide IDs after one Next                     |        0 |         1 |
| Far slide 5 before direct navigation                         |        1 |         0 |
| Far slide 5 added by direct navigation                       |        0 |         1 |
| News listing total/unique Drive requests                     |    2 / 2 |     2 / 2 |
| Content detail before scroll: total/unique Drive requests    |    2 / 2 |     1 / 1 |
| Content-body image requests before scroll                    |        1 |         0 |
| Content-body image requests after scrolling both slots       |        2 |         2 |
| YouTube/Facebook requests before scroll                      |        2 |         0 |
| YouTube/Facebook requests after scrolling both slots         |        2 |         2 |
| Event attachment before dialog                               |        0 |         0 |
| Event attachment after first dialog open                     |        1 |         1 |
| Public fixture media/embed requests on each Auth/Admin route |        0 |         0 |

The historical corrected desktop Home count contains two Carousel slides and the director
portrait. At that measured revision, the below-fold featured and regular cards remained unrequested at the
initial snapshot. The production logo is local and is not included in Drive
counts.

### Selected Drive candidates

| Media role and measured slot       | Baseline | Corrected |
| ---------------------------------- | -------: | --------: |
| Mobile Intro Gate                  |     w640 |      w480 |
| Mobile Carousel                    |     w640 |      w480 |
| Desktop Carousel                   |    w1600 |     w1600 |
| Regular news card, 70 px           |    w1600 |      w160 |
| Featured news card, desktop        |    w1600 |      w320 |
| Director portrait, desktop fixture |     w640 |      w192 |
| Content featured image             |    w1600 |     w1200 |
| Content-body image                 |    w1600 |     w1200 |
| Event attachment dialog            |    w1600 |      w480 |

The large desktop Carousel remains at the bounded w1600 maximum because its declared desktop display size is approximately 1440–1536 px. The performance gain there comes from limiting the request window, not lowering below a useful display candidate.

## Repository governance

`pnpm media:check` fails when:

1. Public image rendering bypasses `PublicResponsiveImage` or `CarouselImageStage`;
2. a Public image consumes `previewUrl` directly;
3. a Public iframe bypasses `PublicDeferredEmbed`;
4. high fetch priority appears outside approved critical-media owners;
5. a small policy has no valid sub-640 candidate;
6. a small fallback reaches 1600;
7. widths are empty, invalid, unsorted, duplicated, or greater than 1600;
8. the central policy is missing or Drive thumbnail generation is duplicated;
9. neutral Public media code imports Admin or CMS Auth modules.

The parser uses the repository TypeScript compiler API instead of exact-format text matching. Unit tests exercise both passing and failing parser/policy cases. `media:check` runs after `perf:check` in `quality` and in the GitHub Actions quality job.

## Synchronous startup budget

| Metric                                       | Baseline | Corrected |   Limit |
| -------------------------------------------- | -------: | --------: | ------: |
| Synchronous JavaScript files                 |        1 |         1 |       1 |
| Synchronous JavaScript raw bytes             |  375,507 |   375,728 | 388,000 |
| Synchronous JavaScript gzip bytes            |  123,506 |   123,576 | 127,000 |
| Forbidden synchronous telemetry associations |        0 |         0 |       0 |

Both historical snapshots pass `pnpm perf:check`. The corrected raw/gzip changes are
+221/+70 bytes and remain 12,272/3,424 bytes below their limits. Current Step 6 must be evaluated against the repository's present performance budget separately; the historical table is not a claim about the current bundle size.

## Limitations

- Measurements in the tables are local deterministic request budgets from the documented 2026-07-28 revision, not observations of the production site or fresh Step 6 measurements.
- The 120-byte SVG fixture makes request identity and candidate selection measurable; it is not evidence of production byte savings.
- No Lighthouse, LCP, CLS, INP, field Web Vitals, CDN cache, or real Google Drive latency result is claimed.
- Browser-selected widths depend on viewport, device pixel ratio, declared `sizes`, and native lazy-loading behavior; the table records the historical Chromium fixture only.
- Arbitrary HTTPS hosts receive safe normalization and current native image deferral but no invented responsive variants.
- If canvas drawing for a fit-blur background is unavailable, the foreground remains usable and the stable background color/gradient remains in place.
