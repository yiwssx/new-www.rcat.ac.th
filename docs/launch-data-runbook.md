# Launch Data Runbook

## Purpose

This runbook is for entering and verifying real production data before public launch. It should be used by staff, editors, reviewers, and admins while preparing the school website for real visitors.

Current status: M20 migration/runtime/domain-cutover scope is closed and M21 stabilization is open. This runbook does not authorize unrelated production data mutation.

- Do not use mock data.
- Do not use `example.com`.
- Do not use `href="#"`.
- Do not enable sections until real data is ready.

When unsure, keep a section disabled or leave an optional field empty. Empty is safer than wrong public information.

## Roles

| Role              | What they verify                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin             | Deployments, Cloudflare/D1 status, Apps Script media bridge status, settings, accounts, permissions, footer links, Messenger, map/contact, visitor stats, and final launch sign-off. |
| Editor            | Media uploads, carousel slides, E-Service links, CMS content, categories, tags, featured media, publish dates, and search/discovery metadata.                                        |
| Reviewer/Approver | Accuracy of public facts, official links, contact details, map location, approved announcements, spelling, mobile layout, and final public page QA.                                  |

## Pre-launch order of operations

1. Confirm approved Cloudflare Worker/D1 structured runtime configuration.
2. Verify admin/editor login.
3. Configure site settings.
4. Configure homepage settings.
5. Upload media.
6. Create carousel slides.
7. Create E-Service links.
8. Configure contact/map.
9. Configure footer/Messenger.
10. Create CMS content.
11. Apply category/tag presets.
12. Verify public pages.
13. Final mobile/tablet/desktop QA.

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
- [ ] Use 16:9 or wide landscape images for carousel slides.
- [ ] Avoid blurry, cropped, stretched, or unofficial images.

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

Use category/tag presets so public homepage sections and search can discover content correctly.

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
- [ ] `/contact`
- [ ] `/search?q=...`
- [ ] `/content/[slug]`

## Admin Verification

For each admin page, verify:

- [ ] Admin can access
- [ ] Editor access is correct
- [ ] Viewer/non-admin restrictions are correct
- [ ] Save action works
- [ ] Public cache refreshes after save
- [ ] Save/delete/publish actions show blocking loading and centered success/error modals requiring acknowledgment

Pages:

- [ ] `/admin`
- [ ] `/admin/content`
- [ ] `/admin/media`
- [ ] `/admin/carousel`
- [ ] `/admin/external-services`
- [ ] `/admin/settings`

## Final Launch Sign-off

| Area             | Owner | Status | Notes | Approved by | Date |
| ---------------- | ----- | ------ | ----- | ----------- | ---- |
| Site identity    |       |        |       |             |      |
| Homepage         |       |        |       |             |      |
| Carousel         |       |        |       |             |      |
| E-Service        |       |        |       |             |      |
| Content          |       |        |       |             |      |
| Contact/map      |       |        |       |             |      |
| Footer/Messenger |       |        |       |             |      |
| Search           |       |        |       |             |      |
| Mobile QA        |       |        |       |             |      |
| Desktop QA       |       |        |       |             |      |
| Deployment       |       |        |       |             |      |

## Rollback Notes

- Revert frontend commit if UI issue.
- Redeploy previous Vercel deployment if needed.
- Redeploy previous Apps Script version only for media bridge issues.
- Follow the operator-approved Cloudflare/D1 pause or rollback path for structured data issues.
