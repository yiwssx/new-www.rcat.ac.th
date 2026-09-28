# RCAT Image Production Worker

This Worker is the production image-delivery service for selected public Google Drive images used by the RCAT website.

It remains isolated from the production public API Worker and does not change CMS storage, Google Drive ownership, D1 data, or public page rendering logic. The frontend opts into this Worker only for the configured public image intents.

## Endpoint

Wrangler publishes the Worker as `rcat-image-production.<account-subdomain>.workers.dev`.

- Health: `/health`
- Image: `/image/<google-drive-file-id>?w=<allowed-width>`

Allowed widths match the public responsive-image policy:

`128, 160, 192, 240, 256, 320, 384, 480, 512, 640, 900, 1200, 1600`

The Worker:

1. Accepts only a Google Drive file ID, never an arbitrary origin URL.
2. Fetches the source from `drive.google.com/thumbnail` at the requested allowed target width.
3. Uses Cloudflare `cf.image` with `fit=scale-down`, fixed quality 82, and AVIF/WebP content negotiation from `Accept`.
4. Returns `Timing-Allow-Origin: *` so browser Resource Timing can be measured from `www.rcat.ac.th`.
5. Returns transformation failures explicitly instead of silently substituting an unrelated response.

## Production scope

The frontend currently enables the Worker for these public image intents:

- `portrait`
- `carousel`
- `intro-gate`

Google Drive remains the source of truth. The application retains its documented Drive retry/fallback behavior where applicable; the Worker is an optimized delivery layer rather than a storage migration.

## Verification

After deployment, verify:

1. `/health` returns `service: "rcat-image-production"` and `status: "ok"`.
2. A representative `/image/<id>?w=<allowed-width>` request returns an image successfully.
3. Production browser smoke and image-delivery regression tests pass before expanding the enabled intent set.
