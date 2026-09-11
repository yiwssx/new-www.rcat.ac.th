# Launch Data Runbook

Updated: 2026-09-11.

## Purpose

This runbook is for entering and verifying real production data before public launch or a deliberate production content/configuration review. It should be used by staff, editors, reviewers, and admins while preparing or validating the school website for real visitors.

Current project status is defined by `docs/architecture/post-p5h-current-project-state.md`. M20/M21 are historical migration/stabilization records, not active phases. Reliability Roadmap v2 is complete: Phase 0, Phase A, Phase B (B1/B2/B3), and Phase C are complete. This runbook does not authorize unrelated production data mutation.

- Do not use mock data.
- Do not use `example.com`.
- Do not use `href="#"`.
- Do not enable sections until real data is ready.

When unsure, keep a section disabled or leave an optional field empty. Empty is safer than wrong public information.

## Roles

| Role              | What they verify                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin             | Deployments, Cloudflare/D1 status, Apps Script media bridge status, system health, settings, accounts, permissions, footer links, Messenger, map/contact, visitor stats, and final sign-off.  |
| Editor            | Media uploads, public documents, carousel slides, E-Service links, CMS content, categories, tags, featured media, publish dates, and search/discovery metadata.                               |
| Reviewer/Approver | Accuracy of public facts, official links, contact details, document metadata, map location, approved announcements, spelling, mobile layout, public route behavior, and final public page QA. |

## Pre-launch order of operations

1. Confirm approved Cloudflare Worker/D1 structured runtime configuration.
2. Verify admin/editor login.
3. Configure site settings.
4. Configure homepage settings.
5. Upload media.
6. Create/publish public document metadata where applicable.
7. Create carousel slides.
8. Create E-Service links.
9. Configure contact/map.
10. Configure footer/Messenger.
11. Create CMS content.
12. Apply category/tag presets.
13. Verify public pages and Search.
14. Verify protected Admin/System Health surfaces.
15. Final mobile/tablet/desktop QA.

Deploy Apps Script only when media/file bridge code under `apps-script/` changed.

## Site Settings Data Entry

- [ ] Site name
- [ ] Eyebrow
- [ ] Intro
- [ ] Campus
- [ ] Address
- [ ] Phone
- [ ] Fax
- [ ] Email
- [ ] Admission URL
- [ ] Facebook URL
- [ ] YouTube URL
- [ ] TikTok URL
- [ ] Hero title
- [ ] Hero description
- [ ] Hero chip
- [ ] Hero image URL
- [ ] Director name
- [ ] Director title
- [ ] Director description
- [ ] Director image URL
- [ ] Google Maps URL
- [ ] Google Maps Embed URL
- [ ] Footer title
- [ ] Footer description

Validation notes:

- Google Maps URL must be the real campus location.
- Embed URL must be from Google Maps embed.
- Social links must be real official accounts.
- Empty is better than wrong.

## Homepage Settings Data Entry

### Intro Gate

Required data:

- [ ] Enabled only when needed
- [ ] Image URL
- [ ] Image alt text
- [ ] Primary button label
- [ ] Optional secondary button label
- [ ] Optional secondary button URL
- [ ] Session storage key

Enable only when there is a real official event, campaign, announcement, or temporary pre-entry notice.

Verify on public homepage:

- [ ] Gate appears only when enabled.
- [ ] Image is real and approved.
- [ ] Primary button enters the website.
- [ ] Secondary button is hidden when label or URL is empty.
- [ ] Secondary button opens the correct real URL when configured.

### Marquee

Required data:

- [ ] Enabled only when there is a current announcement
- [ ] Label
- [ ] Text
- [ ] Speed seconds

Enable only for real time-sensitive public information. Marquee text should not be too long; keep it short enough to read comfortably.

Verify on public homepage:

- [ ] Marquee appears only when enabled.
- [ ] Text is accurate and approved.
- [ ] Animation speed is readable.
- [ ] Animation speed is consistent across desktop, tablet, and mobile.
- [ ] Reduced-motion slows the ticker instead of disabling it.
- [ ] No outdated announcement is visible.

### Intro Video

Required data:

- [ ] Enabled only when a real video is ready
- [ ] Title
- [ ] YouTube embed URL

Use an embed or `youtube-nocookie.com` URL if possible.

Verify on public homepage:

- [ ] Video appears only when enabled.
- [ ] Video loads without error.
- [ ] Title matches the video.
- [ ] The video is official and approved.

## Media Library Data Entry

- [ ] Upload logo/hero/director/carousel/content images.
- [ ] Verify filenames are understandable.
- [ ] Verify image previews load.
- [ ] Verify alt text where applicable.
- [ ] Verify large document uploads up to 100 MB complete through the resumable Drive upload path.
- [ ] Use 16:9 or wide landscape images for carousel slides.
- [ ] Avoid blurry, cropped, stretched, or unofficial images.

## Public Documents Data Entry

Public document metadata is managed at `/admin/documents`; public users can browse the standalone `/documents` archive and the homepage document card.

For each document verify:

- [ ] Title
- [ ] Description where needed
- [ ] Category
- [ ] File URL
- [ ] File name
- [ ] Linked media ID where applicable
- [ ] Published date
- [ ] Status
- [ ] Sort order
- [ ] Pinned state

Rules:

- Keep drafts private until approved.
- Publish only approved public files.
- Confirm the file URL opens the intended document.
- Confirm published records appear in `/documents` and the homepage document surface as expected.
- Confirm draft records do not appear in public responses.

## Carousel Data Entry

Fields:

- [ ] Title
- [ ] Subtitle
- [ ] Chip
- [ ] Image
- [ ] Image alt
- [ ] Button label
- [ ] Destination URL
- [ ] Enabled
- [ ] Order
- [ ] StartAt
- [ ] EndAt

Verification:

- [ ] Public carousel shows only enabled slides.
- [ ] Buttons open correct URLs.
- [ ] Mobile crop looks acceptable.
- [ ] Slide order is correct.
- [ ] Expired or future-dated slides behave as expected.

## E-Service Data Entry

Fields:

- [ ] Title
- [ ] Description
- [ ] URL
- [ ] Tone
- [ ] Icon
- [ ] Enabled
- [ ] Order

Validation:

- No `example.com`.
- No `#`.
- URLs must be real official service URLs.
- Disable links that are not ready.

## Visitor Stats Data Entry

Visitor stats / Who's Online are generated through the Cloudflare analytics path and may be cache-delayed.

Fields:

- [ ] Users Today
- [ ] Users Yesterday
- [ ] Users This Month
- [ ] Users This Year
- [ ] Total Users
- [ ] Total views
- [ ] Who's Online

Rules:

- Enable only if public display of the generated values is approved.
- Keep disabled if analytics behavior or display policy is not approved.
- Record who approved public display and when it should be reviewed.

## Footer and Messenger Data Entry

Footer groups:

- [ ] Group title
- [ ] Link label
- [ ] Link URL
- [ ] Enabled

Messenger:

- [ ] Enabled
- [ ] Label
- [ ] Messenger URL

Rules:

- No `#` links.
- No `example.com`.
- Messenger must be a real official page.
- Disable incomplete footer links instead of publishing broken links.

## CMS Content Data Entry

Content types:

- News
- Announcements
- Blog
- Pages
- Programs

For each content item verify:

- [ ] Title
- [ ] Slug
- [ ] Summary
- [ ] Body
- [ ] Status = published only when approved
- [ ] Publish date
- [ ] Category
- [ ] Tags
- [ ] Featured media
- [ ] SEO title/description if available

## Category/Tag Preset Guidance

Use category/tag presets so public homepage sections and Search can discover content correctly. Search filtering, ordering, total counting, and pagination are Worker/D1-owned; metadata quality still affects discoverability and presentation.

Procurement:

- `จัดซื้อจัดจ้าง`
- `ประกวดราคา / TOR`

Job:

- `สมัครงาน`
- `หางาน / ตำแหน่งงาน`
- `ฝึกงาน`
- `แนะแนวอาชีพ`

Achievement:

- `ผลงาน / ความสำเร็จ`
- `รางวัล / เกียรติยศ`
- `นวัตกรรม`
- `ทวิภาคี / ความร่วมมือ`

Documents:

- `เอกสารเผยแพร่`
- `ITA`
- `แผนงาน / แผนปฏิบัติการ`
- `ประกันคุณภาพ`

## Public Page Verification

For each public page, verify:

- [ ] Loads without error
- [ ] No mock text
- [ ] No `example.com`
- [ ] No `href="#"`
- [ ] Links work
- [ ] Mobile/tablet/desktop checked

Pages:

- [ ] `/`
- [ ] `/news`
- [ ] `/announcements`
- [ ] `/blog`
- [ ] `/departments`
- [ ] `/documents`
- [ ] `/contact`
- [ ] `/search?q=...`
- [ ] `/content/[slug]`

For `/content/[slug]`, remember that current production deliberately uses `Cache-Control: no-store`; do not expect the shared CDN cache behavior used by stable index/list SSR pages.

## Admin Verification

For each applicable admin page, verify:

- [ ] Admin can access
- [ ] Editor access is correct
- [ ] Viewer/non-admin restrictions are correct
- [ ] Save action works where the surface is mutable
- [ ] Public cache refreshes after relevant writes
- [ ] Save/delete/publish actions show blocking loading and centered success/error modals requiring acknowledgment

Pages:

- [ ] `/admin`
- [ ] `/admin/system-health`
- [ ] `/admin/content`
- [ ] `/admin/documents`
- [ ] `/admin/media`
- [ ] `/admin/menu`
- [ ] `/admin/users`
- [ ] `/admin/calendar`
- [ ] `/admin/carousel`
- [ ] `/admin/external-services`
- [ ] `/admin/settings`

System Health verification is read-only/explicit-refresh. B1/B2/B3 are completed operator-visibility controls and do not authorize production mutation.

## Final Launch Sign-off

| Area                | Owner | Status | Notes | Approved by | Date |
| ------------------- | ----- | ------ | ----- | ----------- | ---- |
| Site identity       |       |        |       |             |      |
| Homepage            |       |        |       |             |      |
| Documents           |       |        |       |             |      |
| Carousel            |       |        |       |             |      |
| E-Service           |       |        |       |             |      |
| Content             |       |        |       |             |      |
| Contact/map         |       |        |       |             |      |
| Footer/Messenger    |       |        |       |             |      |
| Search              |       |        |       |             |      |
| Admin/System Health |       |        |       |             |      |
| Mobile QA           |       |        |       |             |      |
| Desktop QA          |       |        |       |             |      |
| Deployment          |       |        |       |             |      |

## Rollback Notes

- Revert frontend commit if UI issue.
- Redeploy previous Vercel deployment if needed.
- Redeploy previous Apps Script version only for media bridge issues.
- Follow the operator-approved Cloudflare/D1 pause or rollback path for structured data issues.
