# Phase A completion checklist

- [x] Automatic post-deploy workflow is triggered from the successful master CI workflow.
- [x] Vercel deployment readiness is verified before browser execution.
- [x] Desktop and mobile Chromium production smoke coverage exists.
- [x] Public routes, SSR marker, search, documents, login, and protected admin boundary are covered.
- [x] Browser console, page errors, failed requests, and bad HTTP responses are collected.
- [x] Horizontal overflow checks distinguish visible layout overflow from intentionally clipped carousel/marquee tracks.
- [x] Carousel accessibility-only elements use explicit pixel geometry.
- [x] Server rendering completes lazy-route Suspense boundaries before Emotion/CSP finalization.
- [x] Unit regression rejects incomplete React server Suspense boundary markers.
- [ ] Final merge SHA passes repository CI.
- [ ] Final merge SHA is READY in Vercel production.
- [ ] Automatic Phase A production browser smoke passes desktop and mobile on the final merge SHA.
