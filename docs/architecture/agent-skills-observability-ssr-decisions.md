# Agent Skills P06/P07 — operational observation and SSR decision record

Reviewed: 2026-10-09 (Asia/Bangkok)

Status: **CODE-ALIGNMENT DECISIONS RECORDED — NO CONFIGURATION OR SSR REWRITE**

## P06 — Cloudflare Worker Logs and Traces

The committed `cloudflare/public-api/wrangler.toml` does not explicitly enable `observability.enabled` or `observability.traces.enabled`. This alone does not prove that Cloudflare's **deployed** Worker has no dashboard-level logging/tracing.

Current established observability boundaries:

- B1/B2/B3 health aggregation and incident handling already exist. `docs/operations/p6a-production-observability.md` owns protected, manual-only, analytics-read D1 usage verification.
- P6B retains the scoped security signal without logging credentials, sessions or personal identifiers. P6C performs bounded public SSR → Worker → D1 probes and avoids duplicate D1 polling.
- There is no evidence that an additional paid observability service or unattended protected-environment job would be justified.

Privacy/cost decision: **do not change Worker Logs/Traces settings now**. Trace samples can capture sensitive URLs/metadata and increase ingestion/retention costs. Selecting `head_sampling_rate` requires real traffic/volume evidence and the provider's current plan costs; setting a value speculatively could increase cost and change the protected deployment.

P06 assessment decision: **RETAIN** the currently tracked Worker configuration and existing P6A/B/C observability owners; no code/configuration change is justified without provider evidence. This closes the code-alignment decision, **not** a Cloudflare production observability certification. The actual Cloudflare Dashboard Worker Logs/Traces enablement, sampling, retention and usage/cost remain unverified. Their later operational verification is a separate read-only check; any config change needs its own protected approval.

## P07 — Emotion SSR response finalizer

The current `src/emotionSsr.ts` calls `response.text()` before critical CSS extraction and injection. That deliberately buffers HTML so the client receives complete Emotion styles, CSP-safe nonce propagation and hydration-compatible markup. It does **not** deliver progressive streamed HTML, regardless of upstream React streaming.

`src/test/emotionSsrBaseline.test.ts` provides a bounded **synthetic** read-only profile for `/`, `/news`, `/documents`, and `/contact` under controlled upstream HTTP 503 failure. Exact PR-head [CI run 37879206231](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/37879206231) succeeded on commit `c7759b5eeafe11b19ed0bf0092f3bbfbec7620b6`; its Unit Tests log reports (one run, non-warm/non-isolated):

Representative CI metrics (HTTP 503 in every case):

- Home (`/`): HTML 73,859 bytes; response-ready 896.4 ms; process heap delta +101,843,992 bytes.
- News (`/news`): HTML 123,452 bytes; response-ready 262.7 ms; process heap delta +20,984,352 bytes.
- Documents (`/documents`): HTML 123,397 bytes; response-ready 332.6 ms; process heap delta -103,173,320 bytes.
- Contact (`/contact`): HTML 73,685 bytes; response-ready 82.0 ms; process heap delta +6,802,232 bytes.

These values are synthetic **failure-path** measurements, not network TTFB, production latency, representative success-route latency, or stable heap allocations (the negative delta demonstrates garbage-collector noise). This is sufficient to document present buffering cost and retain it conservatively; it does not justify a performance improvement claim.

P07 assessment decision: **RETAIN** the existing buffering/finalization path because a progressive alternative has not demonstrated a net improvement under the same Emotion critical-CSS, CSP nonce, SSR status and hydration constraints. The new synthetic regression/profile test is retained; any future streaming rewrite requires repeatable success-path A/B benchmarks, real field TTFB/LCP evidence, and isolated request-memory sampling. No production-facing performance certification is claimed.

## Acceptance boundary

**Code-alignment disposition:** P06 and P07 conclude as **RETAIN / NO CODE CHANGE**, with conservative, documented rationale and successful synthetic guard CI. Operational follow-ups that were not performed (Cloudflare deployed settings/cost; Vercel production success-route TTFB) remain explicitly **UNVERIFIED, OUTSIDE THIS NO-DEPLOY WORKSTREAM**. They must not be represented as tested or closed in operational controls. No Worker or Vercel production configuration, release, credential, or streaming runtime was changed.
