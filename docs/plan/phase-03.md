# Phase 3 — Public shell & template engine (plan)

**Status:** **Done** (25 Nov 2026). Plan approved (P3-A … P3-G); design checkpoint approved (Q8). Outcome and changes against this plan: §11.
**Inputs:**
- MP §3.1–3.4, §10 and §12 (Phase 3 prompt)
- Spec §5.1 (public `layout.tsx`, `/`, `/preview/template/[key]`), §6.1–6.5 (template contract, theme pipeline, section registry, preview, visual direction) and §4.3 (`appearance.createPreviewToken`)
- ADR-000 (CSP with prerendered shells, `/theme.css`) and ADR-002 (one deployment per school)
- Open question Q8 (template designs)

**Depends on:** Phase 2, merged in PR #4.

## 1. Goal

A real public site shell:
- The active template's header and footer on every public page.
- A homepage rendered from `site_settings.homepage`.
- **Four complete templates**: Institutional Classic, Modern Academic, Heritage & Prestige and Contemporary Community.
- A preview route that shows the real homepage in any template without saving anything.

Templates are pure presentation. They receive typed data and never query the database, so switching templates cannot touch content. A test proves this: it snapshots every table's row count and checksum, switches through all four templates, and compares.

## 2. Decisions needed

| ID | Decision | Recommendation |
|---|---|---|
| **P3-A** | **How the designs are made (Q8).** The spec's provisional answer is that Claude creates original designs, with a checkpoint before sign-off. | **Original designs, with a checkpoint halfway.** I build each template's tokens, header, footer, hero and two signature sections, then send you screenshots of all four homepages at 360 px and 1280 px. The remaining sections are built only after you approve the four directions or send changes. The MP §3.3 directions apply, and no existing school site is copied. *Alternative:* you supply mockups or reference sites first. |
| **P3-B** | **Photos for the demo content.** Judging layouts like Modern Academic's needs real photography, and this environment can't reach photo libraries. | **Free-licence stock photos** (Unsplash/Pexels licence), about 16 images, compressed to WebP (about 2.5 MB in total). They're committed for the local seed and the demo gallery only, never a school's production data. I'd pick buildings, classrooms, sport and graduation scenes, with no close-ups of children's faces. Downloading them needs a one-off network allowance for the photo host, which you approve in a prompt. *Alternatives:* generated non-photo placeholders (weaker for judging design), or photos you supply and have rights to. |
| **P3-C** | **Sections whose modules don't exist yet.** News, events, gallery, academics and the leadership message (which needs staff) have no tables until Phases 6–10. | **Typed demo fixtures in a demo gallery only.** `/preview/demo/[key]` shows every section of a template with demo data. It is used for the design checkpoint, `preview.png`, accessibility tests and screenshots, and returns 404 on production. On the real homepage these five sections stay hidden until their module phase adds the real loader. *Alternative:* create those tables now, which is rejected because it pulls in Phases 6–10. |
| **P3-D** | **Preview tokens.** | **Build the signed token, the `appearance.createPreviewToken` action and the route now; the `/admin/appearance` iframe UI comes in Phase 5.** The token is HMAC-signed, lasts 10 minutes and is **bound to the user who created it**, so a copied link is useless to anyone else. `PREVIEW_TOKEN_SECRET` becomes required from this phase. Overrides larger than 4 KB, stored in `content_drafts`, wait for Phase 5's homepage editor. |
| **P3-E** | **Rich text in sections** (introduction, leadership message, text block). | **Build the server-side static renderer now**, with one shared extension list (Tiptap v3 `@tiptap/static-renderer`): server-rendered, no client JS, and only safe link protocols. The editor stays in Phase 4 and reuses the same extension list. |
| **P3-F** | **Heritage & Prestige's "history timeline"** (MP §3.3). The section registry has no timeline type. | **Heritage renders the `statistics` section as a milestone timeline**: each item's value is a year and its label a milestone. It's the same data presented differently, which is exactly what templates are for. *Alternative:* add a `timeline` section type now, which changes the registry and Phase 5's homepage builder. |
| **P3-G** | **How "switching changes nothing" is proven.** No switch action or UI exists until Phase 5. | **Two tests.** (1) **Database:** an integration test switches through all four templates with `update_site_settings`, the same database function Phase 5's action will call, and compares every table's row count and checksum before and after. (2) **Rendering:** an E2E test renders the real homepage in all four templates through the preview route and checks that every seeded section appears in each, so no template drops content. Phase 5 re-runs the same checksum harness through the UI. |

## 3. The four templates

Each template is an original design that follows MP §3.3. Every template gets its own header, footer, page frame (for inner pages) and hero, plus the **signature sections** below. All other sections use shared components styled by the template's tokens; this is also how the fallbacks work (spec §6.3).

| | Institutional Classic | Modern Academic | Heritage & Prestige | Contemporary Community |
|---|---|---|---|---|
| Character | Formal, structured, trustworthy | Spacious, editorial, photographic | Elegant, historic, prestigious | Warm, friendly, busy with activity |
| Header | Contact top bar; centred crest, name and motto; full-width nav bar | Slim sticky bar: logo left, nav right | Crest with "Since {year}", serif wordmark, refined thin rules | Rounded logo badge, pill-shaped nav, prominent "Apply" button (when admissions are enabled) |
| Hero | Photo with a solid brand caption panel (never text over a busy image) | Full-bleed photo, large sans-serif heading over a dark gradient | Framed photo, serif heading, quiet ornamental rule | Split layout: rounded photo beside a text card |
| Signature sections | quick facts strip, latest news (3 columns with dates), leadership message, admissions banner | introduction (editorial split), key numbers (large numerals), gallery mosaic, featured news | key numbers as a **milestone timeline** (P3-F), prominent leadership message, testimonials in serif quotes, academic overview | **upcoming events first**, activity highlights (gallery as rounded tiles), quick-fact icon tiles, testimonial cards |
| Default fonts | Source Serif 4 / Inter | DM Sans / Inter | Playfair Display / Lora | Nunito Sans / Nunito Sans |
| Motion | Fades only | Gentle scroll reveal | Minimal | Small, springy hover lift |

All motion is CSS-only, and none plays when the visitor has set `prefers-reduced-motion`. The default fonts and section order are used only when provisioning a new school. **Switching templates never changes the school's fonts, colours or section order**: those are school settings, not template properties.

## 4. Architecture

### 4.1 Files (MP §3.3)

```
src/features/templates/
  types.ts            TemplateDefinition, ShellData, SectionData, SectionProps (spec §6.1)
  registry.ts         template key → TemplateDefinition (static imports)
  shared/
    section-settings.ts  per-type settings schemas (client-safe; Phase 5's editor reuses them)
    sections.ts       sectionRegistry: label, max, settings, load (server only; spec §6.3)
    loaders/          'use cache' + tags; return null when there is nothing to show
    shell.ts          resolveShell(): logo image, navigation (page links resolved, hidden items removed)
    home-renderer.tsx visible sections in order → the template's component, or the shared fallback
    fallbacks/        token-styled section components shared by all templates
    islands/          MobileNav, HeroSlider (the only client components)
    demo/             typed demo fixtures (demo gallery and tests only)
  institutional-classic/  tokens.css, Header, Footer, PageFrame, sections/*, preview.png, index.ts
  modern-academic/        …
  heritage-prestige/      …
  contemporary-community/ …
  theme/              (from Phase 1) buildThemeVars, validateContrast
src/lib/rich-text/    shared extension list + static renderer (P3-E)
src/features/appearance/  preview-token.ts, actions.ts (createPreviewToken)
src/app/(public)/layout.tsx, page.tsx            real shell + homepage
src/app/preview/template/[key]/page.tsx          real preview (P3-D)
src/app/preview/demo/[key]/page.tsx (+ /page)    demo gallery (P3-C)
```

### 4.2 Rendering pipeline

1. `getSiteSettings()` (cached, tag `site-settings`) → `resolveShell()` → the template from `registry[settings.theme.template]`.
2. The public layout renders `<div data-template="…">`, then the template's `Header`, then `<main id="main-content">`, then its `Footer`.
3. The homepage passes `settings.homepage` to `HomeRenderer`. For each visible section, `sectionRegistry[type].load(settings)` returns data, or `null` to skip the section. The section is then rendered by `template.sections[type]`, or by the shared fallback when the template doesn't define one.
4. Loaders are cached with their own tags (`site-settings`, `media`, `pages`, and later `news`, `events`, …), so a publish refreshes the homepage within seconds without a redeploy (MP §10).
5. An ESLint rule forbids anything under `src/features/templates/**` except `shared/loaders` and `shared/sections.ts` from importing Supabase clients or queries. That **enforces "templates never query the database"**.

### 4.3 Theming and CSS

- Brand variables keep coming from `/theme.css?v=<version>` (ADR-000), unchanged.
- Each template's `tokens.css` maps the brand variables onto its own tokens (`--tpl-surface`, `--tpl-ink`, `--tpl-heading-font`, …), scoped under `[data-template="…"]`.
- One global `@theme inline` block maps Tailwind's colours, fonts and radius onto those `--tpl-*` tokens.
  - *Refinement of spec §6.2, step 4:* Tailwind v4's `@theme` is global, so four per-template `@theme` blocks would collide.
- Brand colours always come from settings. Templates may hard-code only neutral tones such as paper and ink, which MP §3.1 allows under `src/features/templates/**`.
- **Preview overrides** (unsaved colours and fonts) go into a `style` attribute on the template wrapper. `style-src-attr` already allows that, and it avoids an inline `<style>`, which React would strip of its nonce (ADR-000).

### 4.4 Rules every template must meet

- **One `h1` per page.** On the homepage it is the school's name: visible where the template shows it, otherwise visually hidden. Section headings are `h2`. Hero slide titles are not headings, so a five-slide banner doesn't add five headings to the outline.
- **Hero:**
  - Autoplay always has a visible pause control (WCAG 2.2.2) and is off under reduced motion.
  - The first image is preloaded and the rest load lazily.
  - The mobile hero image is AVIF and at most 200 KB (MP §10).
- **Navigation:**
  - The mobile menu is a disclosure button with a panel: Escape closes it and focus returns to the button.
  - Targets are at least 24 × 24 px.
  - Focus is never hidden behind a sticky header (2.4.11).
- **JavaScript:** only two client islands, the mobile menu and the hero slider. Public pages stay at or under **120 KB of JavaScript** (gzipped, MP §10), measured in E2E.
- **Images:** every image uses `next/image` with `sizes` and a blur placeholder from `media_assets.lqip`. Alt text comes from the media library.
- **Copy:** all UI text goes through `t()` ("Menu", "Pause slideshow", "View all news", …).

### 4.5 Preview route (spec §6.4)

`/preview/template/[key]?t=<token>`, with the four keys as static params. The route is rendered per request because it reads the session. It:

1. checks the token's signature and expiry, that it belongs to the signed-in user, and that it was issued for this template
2. checks the user holds `appearance.view` (signed out → login; no permission → "no access")
3. merges the token's theme and homepage overrides into the saved settings, **in memory only**, and renders the real shell and homepage

**It never writes.** It is `noindex`, and for this route only it overrides the global framing rules with `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`, so the Phase 5 appearance screen can embed it. An invalid or expired token shows a plain message.

### 4.6 Demo gallery (P3-C)

`/preview/demo/[key]` shows all 12 section types with demo data. `/preview/demo/[key]/page` shows an inner page in each of the page frame's three layouts. The gallery is `noindex` and already disallowed in `robots.ts`, because it sits under `/preview`. It **returns 404 when `VERCEL_ENV=production`**, and is available locally and on preview deployments.

### 4.7 Local demo seed (`supabase/seed.sql`, local only)

- **Settings:**
  - navigation: About, Academics, Admissions, News, Events and Contact, some with sub-items
  - footer columns, contact details and social links
  - a homepage: three hero slides, introduction, quick facts, key numbers, testimonials, a text block and an admissions call-to-action, plus the five module sections, which stay hidden until their phases
- **Media:** the demo photos (P3-B), as `media_assets` rows with alt text and blur placeholders. The image files are loaded into the local `media` bucket by the CLI's bucket seeding, so `supabase start` and `db reset` both include them.
- **Pages:** published stubs for About and Admissions, so navigation links resolve. They render in Phase 4.
- **Production:** nothing changes. Provisioning never runs `seed.sql`.

## 5. Application code (besides the templates)

| Area | Change |
|---|---|
| Env | `PREVIEW_TOKEN_SECRET` becomes required (at least 32 characters). Local value from `scripts/supabase-env.mjs`; CI placeholder allow-listed in `.gitleaks.toml`. |
| Appearance | `preview-token.ts` (sign and verify; at most 4 KB; bound to the user). `createPreviewToken` uses `defineAction` with `appearance.manage`. |
| Headers | Framing override for `/preview/template/*` only, in `proxy.ts` (CSP) and `next.config.ts` (`X-Frame-Options`). |
| Lint | The templates import rule (§4.2, step 5). |
| Dependencies | Tiptap v3 static renderer and starter kit (server only); `pg` (dev only) for the checksum harness. |

## 6. Tests

**Unit (Vitest):**
- Registry completeness: every template has `Header`, `Footer` and `PageFrame`, and every section type has a template component or a fallback.
- Per-type section settings schemas, for example 1–5 hero slides and autoplay of 4–15 seconds.
- `resolveShell`: page links resolved, hidden items removed.
- `HomeRenderer`:
  - order respected
  - hidden and empty sections skipped
  - unsupported types → fallback
- Preview token:
  - round trip
  - expired
  - tampered
  - wrong user
  - over 4 KB
- Rich text: allowed nodes; `javascript:` links dropped.
- Demo-gallery production guard; `createPreviewToken` permission handling.

**Integration (local Supabase):**
- **The template-switch checksum test** (MP DoD, P3-G). A reusable harness (`test/support/db-snapshot.ts`) records the row count and an md5 of every table in `public` plus `storage.objects`. The test switches through all four templates as a School Administrator and back to the original, then checks:
  - every table is identical, except `site_settings` and `activity_logs`
  - in `site_settings`, `data` is back to the original, and after each switch only `theme.template` differed
  - `activity_logs` gained exactly one `settings.updated` row per switch, so the switches were audited

**E2E (Playwright + axe + CSP guard; 1280 px, 360 px, Pixel 7):**
- **Homepage, seeded template:**
  - sections in the configured order, one `h1`, skip link
  - desktop navigation; mobile menu by keyboard (open, Tab, Escape, focus returns)
  - hero pause control works; no autoplay under reduced motion
- **Preview route:**
  - signed out → login; no permission → "no access"; bad or expired token → message
  - valid token → the candidate template, `noindex`, `frame-ancestors 'self'`
  - **for each of the four templates, every seeded section heading is present** (P3-G)
- **Demo gallery:** all four templates, all 12 sections and the three page layouts, all axe-clean and CSP-clean, with screenshots (design checkpoint and evidence). Each template's `preview.png` (1280 × 800, spec §6.5) is generated from it.
- **Budgets:** JavaScript transferred on `/` at most 120 KB gzipped; the hero image on the 360 px viewport at most 200 KB.

## 7. Order of work

1. Contracts, registry, shared pipeline, loaders, demo fixtures, seed and demo photos.
2. For all four templates: tokens, header, footer, page frame, hero and two signature sections. Then the **design checkpoint**: screenshots to you; I wait for approval or changes.
3. Remaining sections, fallbacks, preview token and route, tests, `preview.png`, docs.

## 8. Docs

- **ADR-016 "Template engine"**:
  - CSS scoping (§4.3)
  - demo gallery (P3-C)
  - preview token binding (P3-D)
  - statistics as a timeline (P3-F)
  - rich-text renderer placement (P3-E)
- **Admin guide** `docs/admin-guide/website-templates.md`: the four looks, what switching changes and what it keeps. The how-to steps come with the Phase 5 screen.
- **Runbook** `docs/runbooks/local-dev.md`: demo content and the demo gallery.
- **Bookkeeping:** CLAUDE.md gotchas, `progress.md` (Phase 2 merged; Phase 3 status), and Q8 in the decisions log.

## 9. Definition of Done evidence (MP §12)

| Item | Expected evidence |
|---|---|
| Migrations applied cleanly to a fresh DB | No new migrations expected (seed only). Fresh `db reset` output. |
| RLS + pgTAP pass | The existing suite (no new tables). |
| Zod schemas shared client/server | Per-type section settings used by the loaders now and by Phase 5's editor. |
| Every action calls `requirePermission` | `createPreviewToken` uses `defineAction`; `check:actions`. |
| Unit + integration tests | Including the checksum test. |
| E2E incl. axe; screenshots at 360 px and 1280 px | All four templates (homepage, demo gallery, preview). |
| Typecheck, lint and build clean | Every page route ◐. |
| Audit entries written | Every switch writes `settings.updated` (asserted in the checksum test). |
| Admin-guide page | `website-templates.md`. |
| `progress.md` updated; no TODOs without an issue link | |
| **Switching templates changes nothing in the DB** | Checksum test output in `evidence/phase-03/`. |
| Design approved | Your checkpoint answer, recorded in the decisions log (Q8). |

## 10. Out of scope

- **The `/admin/appearance` screen** (template picker with live preview, colours, fonts, logo) and the drag-and-drop homepage builder → Phase 5.
- **CMS page rendering** (`/[...slug]`, About subpages) and the Tiptap editor → Phases 4–5. The page frame is built now and shown in the demo gallery.
- **Real loaders for news, events, gallery, academics and leadership** → their module phases; demo fixtures until then.
- **Homepage JSON-LD (`School`)** → Phase 5, with a serialiser that safely escapes user-entered text. CLAUDE.md bans `dangerouslySetInnerHTML` on user content.
- **Hero video slides** → Phase 5. The media library can't store video yet: its MIME types allow images and PDF only.
- **The header search box** → when `/search` is built. The header reserves its place.
- **Lighthouse CI** → Phase 14. Phase 3 records the JavaScript and hero-image budgets in E2E.

## 11. Outcome (25 Nov 2026)

### Definition of Done (MP §12), item by item

Evidence lives in `docs/plan/evidence/phase-03/`.

| Item | Result | Evidence |
|---|---|---|
| Migrations applied cleanly to a fresh DB | ✅ no new migrations; the demo seed loads with `db reset` (19 photos into the local `media` bucket) | `verification.txt` |
| RLS + pgTAP pass | ✅ 20 files, 132 assertions. Four Phase 2 tests counted whole tables and broke once the demo seed added public pages and photos. They now count their own fixtures, or the `admission-documents` bucket | `verification.txt` |
| Zod schemas shared client/server | ✅ per-type section settings (`section-settings.ts`) feed the loaders now and Phase 5's editor later; the preview token's payload and overrides are Zod-checked when signed and when read | unit tests |
| Every action calls `requirePermission` | ✅ `createPreviewToken` uses `defineAction` (`appearance.manage`); `check:actions` | `verification.txt` |
| Unit + integration tests | ✅ unit 192 (94.5 % statements, 100 % functions); integration 10, including **the template-switch checksum test** | `verification.txt` |
| E2E incl. axe; screenshots at 360 px and 1280 px | ✅ 129 passed, 30 skipped by design. All four templates are tested on the homepage, the demo gallery (12 sections, 3 page layouts) and the preview route, and every page is axe-clean and CSP-clean | `verification.txt`, design checkpoint images |
| Typecheck, lint and build clean | ✅ every page route is ◐ | `verification.txt` |
| Audit entries written | ✅ every switch writes one `settings.updated` row, by the switching user (asserted) | `template-switch-checksums.json` |
| Admin-guide page | ✅ `docs/admin-guide/website-templates.md` | |
| `progress.md` updated; no TODOs without an issue link | ✅ | |
| **Switching templates changes nothing in the DB** | ✅ 36 tables were compared after each of four switches. Only `site_settings` and `activity_logs` changed, and the settings document came back byte-for-byte identical | `template-switch-checksums.json` |
| Design approved | ✅ checkpoint answer "Approved, go ahead", recorded as Q8 | `00-decisions.md` |

### Budgets and smoothness (MP §10)

| Measure | Result |
|---|---|
| Hero image at 360 px | ✅ AVIF, 2.4 KB with the placeholder photo (budget 200 KB) |
| Layout shift on load | ✅ 0.000 for the layout; 0.001 including the web-font swap |
| Throttled phone (Pixel 7, CPU 4× slower, slow 4G), three runs | ✅ LCP 0.84–0.89 s and CLS 0.0003. **No long frame while scrolling.** The slide change produced 51–72 ms frames with at most 7 ms of script, well inside INP 200 ms (`smoothness-android.json`) |
| First-load JavaScript (ADR-017: framework + at most 20 KB of ours) | ✅ 147 KB: the framework is 132 KB, ours is 15 KB (down from 25 KB). MP §10's 120 KB total was restated in ADR-017 (Q27) |

### Changes against this plan

- **21st.dev studies (your request).** The intuitive patterns adopted are expanding menu groups with pinned actions, a single slideshow capsule, and a progress dot that is the timer. The liquid-glass material is used only on floating controls. Scroll-drawn motion uses CSS timelines on transform only (ADR-016 §8).
- **Fonts.** next/font's fallbacks assume Arial or Times New Roman, so matched faces for Android and Linux were added (`src/lib/fonts/fallbacks.css`, generated and tested). They cut the font-swap shift from 0.19 to 0.001. The fonts themselves stay on next/font with `swap` (MP §10). Self-hosting with a per-school preload needs new packages and was not done.
- **JavaScript.** The slideshow island lost tailwind-merge and the icon runtime, and the CSP nonce helper moved to the admin layout. The 120 KB total couldn't be met by app changes, so ADR-017 (Q27) budgets our part at 20 KB on top of the framework. E2E enforces that and records the total.
- **Accessibility fixes found by E2E.** Logo links are now named by their visible text (WCAG 2.5.3). axe waits for the hero entrance, so it never measures contrast mid-fade.
- **Preview bar.** The preview route shows a slim "Preview of … Nothing here is saved" bar with a link back to Appearance.
- **Not built:** bespoke versions of every plan §3 signature section. Sections a template doesn't design use token-styled shared renderers, and the approved checkpoint pages show all of them.
