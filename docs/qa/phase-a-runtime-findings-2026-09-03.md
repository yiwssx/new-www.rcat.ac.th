# Phase A runtime findings — 2026-09-03

## Field evidence

The first automatic Phase A production browser smoke reached the deployed site successfully and exposed two issues that were not visible from source review or the pre-existing CI lanes:

1. Raw `document.scrollWidth` treated intentionally clipped carousel and marquee tracks as horizontal layout failures.
2. The production SSR document emitted an incomplete React Suspense boundary and the browser raised React production error #419 during hydration.

## Root causes and fixes

- Production overflow validation now evaluates visible, unclipped geometry rather than raw document scroll width. Elements intentionally outside an `overflow-x: hidden|clip|auto|scroll` ancestor no longer create false positives, while visible overflow still fails with element diagnostics.
- `PublicHomeCarousel` accessibility-only content now uses explicit CSS pixel values (`1px`, `-1px`) instead of MUI System numeric sizing/spacing semantics.
- Public SSR now renders through TanStack Router's `renderRouterToStream` path. The existing Emotion finalizer still buffers the completed response before critical CSS extraction, preserving the current response/security pipeline while allowing lazy route Suspense boundaries to complete server-side.
- SSR regression coverage rejects React's incomplete server boundary marker (`<!--$!-->`).

## Completion criteria

Phase A is complete only after the final merge SHA passes repository CI, reaches a READY Vercel production deployment, and the automatically triggered Phase A browser smoke passes desktop and mobile production checks without runtime/page errors.
