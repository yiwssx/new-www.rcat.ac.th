# Production Readiness Checklist

## Launch-critical checks

- [ ] Apps Script deployed after latest `apps-script` changes.
- [ ] Spreadsheet sheets/settings initialized.
- [ ] Admin account tested.
- [ ] Editor account tested.
- [ ] Public snapshot loads.
- [ ] Public homepage loads without mock content.
- [ ] Carousel has real enabled slides or is intentionally hidden.
- [ ] E-Service has real enabled links or is intentionally hidden.
- [ ] Visitor Stats enabled only if real/manual numbers are approved.
- [ ] Achievement section has real CMS content or is intentionally hidden.
- [ ] Footer directory has real links or is intentionally hidden.
- [ ] Messenger enabled only with real URL.
- [ ] Google Maps URL/embed verified against real campus location.
- [ ] Search page tested.
- [ ] Contact page tested.
- [ ] Mobile/tablet/desktop layout checked.
- [ ] Vercel deployment success.
- [ ] No public `example.com` links.
- [ ] No public `href="#"` links.
- [ ] No public Mock chip/text.

## Admin data-entry checklist

- [ ] Follow [Launch Data Runbook](./launch-data-runbook.md) for staff data entry and sign-off.
- [ ] Site settings: site name, hero text, campus, phone, email, address, social links, director details, footer title/description.
- [ ] Homepage settings: IntroGate, Marquee, and IntroVideo enabled only when real image/text/video URLs are ready.
- [ ] Carousel slides: real title, subtitle, chip, image URL/media, image alt text, destination URL, order, enabled status, and date window.
- [ ] E-Service links: real service title, description, URL, tone, icon, order, and enabled status.
- [ ] Visitor stats: manual values approved by staff before enabling.
- [ ] Footer links: real labels and URLs, no `#`, no examples, enabled only when ready.
- [ ] Messenger: real `https://m.me/...` URL and approved button label before enabling.
- [ ] Contact/map: real campus contact information and verified Google Maps URL/embed.
- [ ] Content metadata presets: use procurement/job/achievement/document presets when creating homepage-discoverable content.
- [ ] News/announcements/programs/pages: titles, summaries, slugs, statuses, publish dates, categories, tags, media, and SEO fields reviewed.

## Manual QA checklist

- [ ] Home page.
- [ ] News page.
- [ ] Announcements page.
- [ ] Blog page.
- [ ] Departments page.
- [ ] Contact page.
- [ ] Search page.
- [ ] Content detail page.
- [ ] Admin dashboard.
- [ ] Content editor.
- [ ] Media library.
- [ ] Carousel admin.
- [ ] E-Service admin.
- [ ] Settings page.

## Deployment checklist

- [ ] Run `pnpm quality`.
- [ ] Run `pnpm build`.
- [ ] Confirm Vercel deployment success.
- [ ] Run `pnpm gas:push` when Apps Script changed.
- [ ] Clear/reload public CMS cache.
- [ ] Verify public snapshot after deploy.

## Rollback plan

- [ ] Revert latest commit if the issue is frontend-only and redeploy.
- [ ] Re-deploy previous Vercel deployment if immediate rollback is needed.
- [ ] For Apps Script issues, redeploy previous Apps Script version if available.
- [ ] Keep backup/export of Google Sheet before major data changes.

## Known limitations

- Visitor stats are manual/CMS-backed, not real-time analytics.
- Search is client-side/public snapshot search, not server-indexed search.
- Carousel images rely on correct uploaded media/URL quality.
- Category/tag discovery depends on editor metadata discipline.
- Footer/Messenger/Map are admin-managed and must be populated with real data.
