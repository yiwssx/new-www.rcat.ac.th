# RCAT Image Delivery Test Worker

This Worker is an isolated experiment for measuring whether Cloudflare image transformations improve delivery of public Google Drive images used by the RCAT website.

It is intentionally **not** part of the production public API Worker and does not change CMS storage, Google Drive ownership, D1 data, or public page rendering.

## Endpoint

After deployment, Wrangler publishes the Worker as `rcat-image-test.<account-subdomain>.workers.dev`.

- Health: `/health`
- Image: `/image/<google-drive-file-id>?w=<allowed-width>`

Allowed widths match the existing public responsive-image policy:

`128, 160, 192, 240, 256, 320, 384, 480, 512, 640, 900, 1200, 1600`

The Worker:

1. Accepts only a Google Drive file ID, never an arbitrary origin URL.
2. Fetches the source from `drive.google.com/thumbnail` at width 1600.
3. Uses Cloudflare `cf.image` with `fit=scale-down`, fixed quality 82, and AVIF/WebP content negotiation from `Accept`.
4. Returns `Timing-Allow-Origin: *` so browser Resource Timing can be measured from `www.rcat.ac.th`.
5. Does not silently fall back to the original Drive image when transformation fails. Failures remain visible during the experiment.

## Measurement scope

Use only a small representative set of public images first:

- Intro Gate
- selected/first Carousel slide
- Director portrait
- Hero or featured content image

Compare direct Drive delivery and this Worker for:

- resource TTFB
- transfer duration
- transferred bytes
- cache behavior
- image format
- LCP impact on mobile and desktop

Do not migrate image ownership or change the production frontend until field evidence shows a material benefit.
