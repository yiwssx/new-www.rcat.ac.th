// Phase C3 production verification must exercise the frontend source that is on master.
// Keep this marker frontend-scoped so Vercel's Ignored Build Step cannot classify the
// release commit as CI/backend-only while the production alias is still on an older build.
export const PHASE_C3_FRONTEND_RELEASE = "2026-09-07-round-18";