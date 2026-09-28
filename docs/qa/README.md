# Production QA

Phase A validates the deployed production experience after a successful `main` CI run and Vercel deployment. It is intentionally non-mutating: public pages and unauthenticated CMS boundaries are exercised without creating production data.

See `phase-a-runtime-findings-2026-09-03.md` for the first field findings and `phase-a-completion-checklist.md` for the completion evidence. The current automated production entry point is the **Production Verification** workflow.
