# Phase 4 — CMS core (plan)

**Status:** **Awaiting approval.**
**Inputs:**
- MP §5 (shared content lifecycle), §5.9 (Pages & CMS), §5.10 (Admin dashboard), §7.4 (storage), §7.5 (rich text), §11 (admin UX) and §12 (Phase 4 prompt, Definition of Done)
- Spec D2–D4, D7, D12, §1.3–1.4, §2.3, §3.1, §3.4, §3.9, §4.0–4.2, §4.8, §5.0, §5.1 (`/[...slug]`, `/about`, `/legal`), §5.4 (`/admin/overview`, `/admin/pages`, `/admin/media`, `/admin/trash`), §8
- Open questions Q4, Q10 and Q24 (`00-decisions.md`), which must be confirmed in this phase

**Depends on:** Phase 3, merged in PR #5.

## 1. Goal

An editor can:
1. create a page with an image (the image can't be used until it has a description)
2. watch it autosave
3. preview the draft
4. schedule it, and see the scheduled-publish job put it live

Two people editing the same page get "Someone else edited this — reload to see their changes." Nobody's work is silently overwritten. E2E tests prove each of these.

## 2. What already exists and is reused

| Built in | What | Phase 4 use |
|---|---|---|
| Phase 2 | `pages`, `media_assets`, `media_usages`, `content_drafts`, `redirects` tables; RLS; `content_lifecycle_guard` (spec §2.3 transitions, `version` bump, redirect on slug change); page path trigger (depth ≤ 3, reserved names); the `media` bucket and its policies; `defineAction`, error mapping, `log_activity`, cache tags | Used as they are. Only the gaps in §5 get new migrations. |
| Phase 1–2 | Admin shell, permission-filtered sidebar, `SaveStateIndicator`, `ConfirmDialog`, `EmptyState`, `StatusBadge`, `OfflineBanner`, toasts | Used as they are. The sidebar gains **Trash**. |
| Phase 3 | `src/lib/rich-text` (one extension list + static renderer + `safeHref`), the templates' `PageFrame` in three layouts, `getImageRefs`/`getPagePaths` loaders, the HMAC preview-token pattern, demo pages in the seed | The editor uses the same extension list. Public pages render in the active template's `PageFrame`. Draft preview tokens reuse the signing code with their own purpose prefix. |

## 3. Decisions needed

| ID | Decision | Recommendation |
|---|---|---|
| **P4-A** | **Q4: approval workflow.** | **Confirm the provisional default.** `features.contentApproval` is **off** by default. When a school turns it on, people without `approve` see "Submit for review" instead of "Publish to website". `approve` is then required to publish, schedule, hide, archive or change a live page; `publish` alone is not enough. The database trigger already enforces this, and Phase 4 adds the buttons, a "Send back with a note" action and a dashboard tile ("2 pages waiting for your approval"). Review-request **emails** need the email dispatcher, so they come with Phase 11; the tile covers it until then. |
| **P4-B** | **Q10: editing only your own items.** | **Confirm: no restriction.** Anyone with `pages.edit` can edit any page. Accountability comes from the "Last edited by … at …" line in the editor and the audit log. Small schools share work, and a restriction would block cover when someone is away. |
| **P4-C** | **Q24: documents in the media library.** | **Confirm: PDF only.** PDFs can be linked from page text (a prospectus, a fees letter). Office files stay in the resource centre (Phase 11), which has versioning and download counts. |
| **P4-D** | **Two people editing the same page.** `content_drafts` holds **one** working copy per page, so two people autosaving the same page would overwrite each other's unsaved text: exactly what MP §5 forbids. | **One working copy per person**, by adding `updated_by` to the primary key (migration). Each person can only read and write their own copy. On top of the `version` check (spec D3): (1) the editor shows "Sarah Namu is also editing this page" when someone else's copy changed in the last 2 minutes; (2) a stale save gets the MP conflict message, and **your text is kept**. After reloading you see "You have changes from before someone else's edit", with *Show my changes* or *Discard them*. ADR-005. |
| **P4-E** | **Where "used in" references are kept.** The spec rebuilds `media_usages` in app code after each save. That takes several requests with no transaction, and a missed one lets an in-use image be deleted. | **A database trigger** on `pages` rebuilds the usages from the body (image node ids and PDF links), the cover and the SEO image, in the same statement as the save. The existing `ALT_TEXT_REQUIRED` check therefore stops a save or publish that contains an undescribed image, whatever the client sends. Later modules attach the same function. |
| **P4-F** | **How images are stored in rich text.** | **The image node stores only the media id** (plus an optional caption and a size: normal or full width). The image file and its description are looked up at render time. A corrected description or a replaced photo then updates every page that uses it, and no URL or base64 data is ever stored in the text (CLAUDE.md). |
| **P4-G** | **Upload processing.** | **As spec §4.2, with two cuts.** The browser shrinks photos to 2,560 px and converts iPhone HEIC to JPEG; both libraries load only when needed. It uploads straight to Storage through a signed URL, with a progress bar. The server's confirm step checks the real file type from its first bytes, strips EXIF (including GPS) with `sharp`, rotates and stores a tiny blurred placeholder. **Cut 1: SVG is rejected** ("Please upload a JPG, PNG or WebP photo"), because safe SVG needs a sanitiser and jsdom on the server. Logos are the only real SVG need, so this is decided in Phase 5. **Cut 2: no blurhash**, as the placeholder already does that job. |
| **P4-H** | **Where old addresses are redirected.** The spec has `proxy.ts` read a cached redirect map on **every** request. | **Look redirects up only when a page isn't found**: the CMS catch-all route checks `redirects` before showing "not found", and Phase 6+ detail routes do the same. Every request avoids the lookup, and the behaviour (308 to the new address, chains collapsed) is unchanged. |
| **P4-I** | **Scheduler.** Vercel now offers **Schedules**, which replace the legacy Cron Jobs that the spec's `vercel.json` `crons` assumed. | **A Vercel Schedule** every 5 minutes calls `/api/cron/publish` with `Authorization: Bearer CRON_SECRET` (plan tier: Q1). It publishes every due scheduled page in one database call and expires the affected cache tags at once, so the page is live on the next visit. Locally and in E2E the test calls the route itself. If Schedules can't send the bearer header, the fallback is legacy `crons`, which still work. I'll check this before building. |
| **P4-J** | **Reordering and nesting pages.** | **Buttons first:** "Move up", "Move down", "Move into the page above" and "Move out". They work by keyboard, touch and on old tablets. Drag-and-drop arrives in Phase 5 with the homepage builder's drag library, which then serves both screens. |
| **P4-K** | **Dashboard tiles for modules that don't exist yet.** Every tile must link to a filtered list (MP §5.10). | **Tiles only where the list exists.** Phase 4 shows: pages waiting for approval, pages scheduled in the next 48 hours, drafts not touched for 30 days, photos missing a description and Trash, plus recent activity (with `activity.view`) written as plain sentences without personal data. Tiles are a small registry, and each module phase adds its own (applications waiting more than 7 days, new enquiries, next event). |
| **P4-L** | **Emptying Trash after 30 days.** | **Phase 13**, with the retention job (spec §4.8). Until then Trash shows "Kept until 25 Dec 2026", and Super Administrators can delete permanently by typing the item's title. Nothing is deleted automatically before Phase 13. |

## 4. The content lifecycle (shared by every module)

The database trigger stays the authority. The app gets a **pure TypeScript mirror** of spec §2.3 (`src/features/content/lifecycle.ts`). It is used only to decide which buttons to show, and a test checks it against the same table as pgTAP `30_lifecycle.sql`, so the two can't drift.

```
            Save draft                Publish to website ──► published ──► Hide from website ─┐
  (new) ──► draft ───────────────────┤                                                        │
              ▲  Submit for review    └─ Schedule… ──► scheduled ──(job, when due)──► published│
              │  (approval on)                          │ Cancel schedule ──► draft          │
              └── Send back ◄── in_review ──Approve──────┘                                    │
              └───────────────────────────────────────────────────────────────────────────────┘
  any state ── Move to Trash ──► (deleted_at set) ── Restore ──► previous state
                                                  └─ Delete permanently (trash.purge, type the title)
```

- **`createContentActions(module, table, schema)`** (spec §4.1) implements `create`, `autosaveDraft`, `saveDraft`, `submitForReview`, `sendBack`, `publish` (now or scheduled), `unpublish`, `archive`, `trash`, `restore`, `purge` and `duplicate` once. Each is a `defineAction`, so it re-checks the permission, writes an audit row and expires the tags. Pages are the first user; Phases 6–11 reuse it unchanged.
- **Optimistic concurrency (D3):** every write sends `version` and runs `update … where id = $1 and version = $2`. Zero rows means `CONFLICT`.
- **Autosave (D4, P4-D):**
  - Saves to your working copy every 10 s while there are changes, and when you leave the field or the tab.
  - The save-state indicator shows "Saving…", "All changes saved" or "Not saved — check your connection". Offline saves retry with backoff.
  - The browser warns before you leave with unsaved changes.
  - The server skips saves less than 5 s apart.
  - Applying the copy ("Save draft" or "Publish to website") writes it to the page and deletes the copy.
  - A live page is never changed by autosave.
- **Scheduling:** the date and time are entered and shown in the school's time zone (`site_settings.locale.timezone`) and stored in UTC. The time must be in the future. "Cancel schedule" returns the page to draft.
- **Restore** brings back the page's previous status. If its address is now taken, it gets `-2` and the toast says so.

## 5. Database changes (one migration, plus pgTAP written first)

| Change | Detail |
|---|---|
| Per-person working copies (P4-D) | Primary key `(entity_type, entity_id, updated_by)`. The policies become: read and write only your own copy. A `security definer` function `content_editors(entity_type, entity_id)` returns only *who* else has a copy and *when*, for the "also editing" notice, never their text. |
| Usage tracking (P4-E) | `private.sync_media_usages(entity_type, entity_id, media_ids uuid[], field)` plus a `pages` trigger that collects ids from `body` (`jsonpath`), `cover_media_id` and `seo.ogImageMediaId`. Purging a page clears its usages first, so the `restrict` foreign key never blocks a purge. |
| Unconfirmed uploads | `media_assets.confirmed_at`. Rows appear in the library, and to visitors, only once the server has checked the file. The hourly `housekeeping()` removes rows that stay unconfirmed for over an hour, and the cron route removes their objects. |
| Scheduled publishing | `public.publish_due_content()` (`security definer`, executable only by `service_role`) moves due `scheduled` rows to `published` and returns `{table, id, path}` for revalidation. It writes one `pages.publish` audit row per item with `source = 'cron'`. It covers pages now; each module phase adds its table to it. |
| Dashboard | `public.get_dashboard_counts()`: `security invoker`, so RLS decides what each person can count. |
| Editors' names | An invoker view over `profiles` exposing only `id` and `full_name`, for "Last edited by". |

**New pgTAP files** (each shown failing before its migration exists):
- `33_content_drafts.sql`: you can't read, change or delete someone else's working copy; a person without `pages.edit` has none; `content_editors()` reveals no text.
- `34_media_usages.sql`: saving a body with an undescribed image fails with `ALT_TEXT_REQUIRED`; usages follow edits; an in-use photo can't be trashed (`MEDIA_IN_USE`); purge works; unconfirmed media is invisible to visitors.
- `35_publish_due.sql`: only `service_role` can run it; it publishes only due, non-deleted, scheduled rows; it writes the audit rows; visitors see the page afterwards and not before.
- `30_lifecycle.sql` gains: cancel schedule, restore to the previous status, and approval-on publishing by `approve` (P4-A).

## 6. Application

### 6.1 Files

```
src/features/content/        lifecycle.ts, actions-factory.ts, drafts.ts, slug.ts, schedule.ts, schema.ts
  components/                editor-shell (status bar + action bar by permission), use-autosave,
                             conflict-dialog, schedule-dialog, also-editing notice, rich-text-editor
src/features/pages/          schema.ts, queries.ts, actions.ts (+ move, reorder), permissions.ts
  components/                page-tree, page-editor, seo-panel
src/features/media/          schema.ts, queries.ts, actions.ts, processing.ts (server: file-type, sharp)
  components/                media-library (grid/list, search, filters), uploader (resize, progress),
                             details-drawer (description, caption, "Used in", replace, trash), media-picker
src/features/dashboard/      tiles.ts (registry), queries.ts, components/
src/lib/rich-text/           + image node (media id) and document link, shared by editor and renderer
src/app/admin/               overview, pages, pages/[id], media, trash
src/app/(public)/[...slug]/  CMS pages by path (incl. /about/… and /legal/…), redirect lookup on a miss
src/app/api/draft/           enable (token + session) and disable
src/app/api/cron/publish/    scheduled publishing (the only new user of lib/supabase/admin.ts)
vercel.json                  the 5-minute schedule (P4-I)
```

### 6.2 Screens (spec §5.4, MP §11)

- **Overview:** the P4-K tiles, each linking to a filtered list, plus recent activity. Nothing to show → "All caught up".
- **Pages:** tree with status badges, search, status filter chips and P4-J move buttons. Cards below 768 px. The empty state teaches: "No pages yet. Add your first page — you choose whether it appears in the menu."
- **Page editor:**
  - Fields: title, address (generated from the title until first published, then editable with "the old address will redirect here"), rich text, layout, parent, "Show in menu", SEO panel ("How this page looks on Google"), cover image.
  - Status bar: save state, "Last edited by … at …".
  - Action bar, filtered by permission: Save draft · Preview · Publish to website / Submit for review · Schedule… · Hide from website · Move to Trash.
  - The "You have unpublished changes" banner on a live page.
- **Rich-text editor:**
  - Tiptap v3 with `immediatelyRender: false`, loaded only on the editor route, using the shared extension list.
  - Toolbar: headings 2–4, bold, italic, lists, quote, link, line, image, PDF link. Buttons are at least 44 px high and work without a mouse.
  - Pasting from Word keeps only what the extension list allows.
- **Media library:**
  - Grid/list toggle, search, filters (photos/PDFs, date) and a "Missing description" badge and filter.
  - Drag-drop or tap to upload, with per-file progress and plain size errors ("This file is 18 MB. The limit is 10 MB. Try a smaller photo.").
  - Details drawer: description, caption, "Used in" with links, replace (same id), trash. An in-use photo offers "Replace" instead of trash.
- **Picker (editor and cover):** a photo without a description **can't be inserted**. The picker asks for it on the spot ("Photo description (for blind visitors and Google)") and saves it to the library first.
- **Trash:** pages and media you may delete, with "Kept until …", Restore, and, for `trash.purge`, "Delete permanently" behind a typed-title confirm. Shown in the sidebar to anyone with any `.delete`.
- Every destructive action uses `ConfirmDialog` with the item's name: "Move 'Sports Day 2026' to Trash? You can restore it from Trash for 30 days."

### 6.3 Public pages and preview

- `/[...slug]` loads the published page by `path` (`'use cache'`, tags `pages` and `page:<path>`) and renders it in the active template's `PageFrame`. `with_sidebar` lists sibling pages, plus breadcrumbs. The body goes through the static renderer: images use `next/image` with the library's description and blur placeholder, and external links get `rel="noopener noreferrer nofollow"` (MP §7.5). No match → redirect lookup (P4-H) → the template's not-found page.
- **Preview:**
  - "Preview" opens `/api/draft?token=…`. The token is HMAC-signed, lasts 10 minutes and is bound to you and to the page.
  - The route checks your session and `pages.view`, turns on Next.js draft mode and redirects to the page address.
  - In draft mode the page renders on each request through the user-scoped client, showing **your working copy** (or the saved draft).
  - A fixed "PREVIEW — not published" bar has "Exit preview". `proxy.ts` sends `X-Robots-Tag: noindex` whenever the draft-mode cookie is present.
  - A visitor without a valid session never sees draft content, even with the cookie.
- **Publishing** expires `pages`, `page:<path>`, `sitemap` and, when the menu could change, `site-settings`. The acting editor sees their own write immediately (`updateTag`).

## 7. Dependencies

`@tiptap/react` and `@tiptap/extension-placeholder` (admin only, same 3.33 line); `sharp` and `file-type` (server only); `browser-image-compression` and `heic-to` (admin only, loaded on demand). None loads on public routes, so ADR-017's 20 KB stays as it is. E2E keeps enforcing it.

## 8. Tests

**Unit (Vitest):**
- Lifecycle mirror against the §2.3 table, approval on and off.
- Slug generation (UK place names, apostrophes, reserved names).
- Schedule time conversion in Africa/Kampala.
- Collecting media ids from Tiptap JSON (matches the SQL trigger on shared fixtures).
- Image node render: description from the library; a missing image is dropped.
- Upload validation fixtures: a JPEG with GPS EXIF (removed), a PNG renamed `.jpg`, an `.exe` renamed `.png`, an SVG (rejected), a 25 MB file (rejected).
- Draft token: round trip, expired, wrong user, wrong page.
- Autosave hook: debounce, retry, offline state, `beforeunload`.
- Dashboard tile visibility by permission.

**Integration (local Supabase, `actionsMatrix`):** every new action covers unauthenticated, wrong role, invalid input, happy path with an audit row, and a stale version giving `CONFLICT`. Also:
- The cron route rejects a missing or wrong secret.
- Two people's autosaves never overwrite each other.

**E2E (Playwright + axe + CSP guard; 360 px and 1280 px screenshots):**
1. **Create, autosave, preview, schedule, publish:**
   - The Content Editor creates a page and inserts a photo; the picker blocks it until a description is given.
   - Typing shows "Saving…" then "All changes saved"; a reload keeps the text.
   - Preview shows the bar, the photo and its description, with `X-Robots-Tag: noindex`; visitors get a 404.
   - Schedule for the next minute: a cron call before that publishes nothing; once it is due, the cron route is called and the page is live for visitors, with the photo's description.
2. **Conflict:** the Content Editor and the School Administrator open the same live page in two browser contexts. The administrator publishes a change. The editor's publish shows **"Someone else edited this — reload to see their changes."** The administrator's change is what visitors see, and the editor's text is offered back after reload. The "also editing" notice is shown.
3. **Trash and restore:** trash a page (confirm dialog names it); visitors get a 404; restore; it's back. An in-use photo can't be trashed; Replace is offered.
4. **Slug change:** an old address gives a 308 to the new one.
5. **Approval on:** the editor can only submit; the Headteacher sees the dashboard tile and approves.
6. **Sidebar and dashboard per role:** Trash only with a `.delete`; Read-only Staff see pages but no edit buttons, and the server rejects their direct action calls.

## 9. Order of work

1. pgTAP (red) → migration → green. Lifecycle mirror, content action factory, draft token.
2. Media: upload, processing, library, picker.
3. Pages: editor, autosave, conflict handling, tree, public catch-all, preview.
4. Cron route and schedule, dashboard, Trash.
5. E2E, screenshots, docs, Definition of Done report.

I'll send screenshots of the editor and the media library (360 px and 1280 px) after step 3 so you can comment on the editing experience before the rest is finished. This does not block the work.

## 10. Docs

- **ADR-005** "Autosave to per-person working copies and optimistic concurrency" (D3, D4, P4-D), with the usage trigger (P4-E) and the image-by-id rule (P4-F).
- **ADR-018** "Media uploads": direct upload, server checks, EXIF removal, SVG deferred (P4-G).
- **Decisions log:** Q4, Q10 and Q24 confirmed (or as you answer); P4-H and P4-I recorded.
- **Admin guide** in `docs/admin-guide/`: `pages.md` (create, menu, addresses), `publishing.md` (drafts, preview, scheduling, approval, conflicts), `media-library.md` (uploading, descriptions, replace), `trash.md`, `dashboard.md`.
- **Runbook:** `local-dev.md` (calling the publish job locally); new CLAUDE.md gotchas as learned; `progress.md`.

## 11. Definition of Done evidence (MP §12)

| Item | Expected evidence |
|---|---|
| Migrations applied cleanly to a fresh DB | `db reset` output |
| RLS + pgTAP pass | Red run of the new files, then green, in `evidence/phase-04/` |
| Zod schemas shared client/server | Page, media and schedule schemas used by forms (`useClientCheck`) and actions |
| Every action calls `requirePermission` | `defineAction` throughout; `check:actions`; `actionsMatrix` completeness test |
| Unit + integration tests | Output and coverage |
| E2E incl. axe; 360 px and 1280 px screenshots | §8 flows 1–6 |
| Typecheck, lint, build clean | Output; every page route ◐ |
| Audit entries written | Asserted in integration tests and `35_publish_due.sql` |
| Admin-guide pages | §10 |
| `progress.md` updated; no TODOs without an issue link | |
| **Phase goal** (§1) | E2E flows 1 and 2 |

## 12. Out of scope

- News, events and other modules' screens (Phases 6–11). They reuse `createContentActions`, the editor and the picker.
- Homepage builder, appearance screen, drag-and-drop, SVG logos, About and Legal *content* (Phase 5). Phase 4 renders any page at any path, including those trees.
- Embeds (YouTube, Vimeo, Maps) in rich text: Phase 9 (video, Q23) and Phase 11 (maps).
- Review-request emails (Phase 11, P4-A), automatic Trash emptying (Phase 13, P4-L), site search `/search` and `sitemap.xml` (Phase 6, when there is more than pages to index), the activity-log screen (Phase 13).
