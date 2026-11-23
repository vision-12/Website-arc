# ALTRASTATE SCHOOL — Master Build Prompt for Claude Code

> **How to use this file**
> 1. Create an empty GitHub repo `altrastate-school`, clone it, and put this file at `docs/MASTER_PROMPT.md`. Put the PRD PDF at `docs/PRD.pdf` and the companion `CLAUDE.md` at the repo root.
> 2. Start Claude Code in the repo, switch to **plan mode** (Shift+Tab until "plan mode on"), and paste **Section 0** below.
> 3. Run one phase per session. For each phase, paste its prompt from **Section 12**. Run `/clear` between phases. The plan files and `docs/` keep the context between sessions.
>
> Stack: **Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form · Tiptap v3 · Resend + React Email · Vitest · Playwright · Vercel · GitHub Actions**
>
> Research baseline: November 2026. Where this prompt conflicts with the PRD, this prompt wins, because it reflects platform changes made after the PRD was written. Every such override is marked **⚠ OVERRIDE**.

---

## SECTION 0 — Kickoff prompt (paste this first, in plan mode)

```
You are the lead engineer for Altrastate School: a reusable school website + CMS + admissions
platform built by Altrastate Technologies Ltd. (Uganda). One codebase is deployed many times:
one Vercel project + one Supabase project + one domain per school.

Read, in this order, before proposing anything:
  1. CLAUDE.md
  2. docs/MASTER_PROMPT.md   (this file — the binding engineering spec)
  3. docs/PRD.pdf            (the business requirements; sections 1–24)

Then produce docs/plan/00-technical-spec.md containing:
  - Final database schema (every table, column, type, FK, index, constraint, enum)
  - The full permission matrix (role × permission) as a table
  - Every RLS policy, written out as SQL, per table and per operation
  - Every Server Action / Route Handler with its input Zod schema, required permission,
    and side effects (DB writes, emails, revalidation tags, audit log entries)
  - Page-by-page requirements for /(public) and /admin, including empty/loading/error states
  - The template/theme contract (TypeScript types) and the homepage section registry
  - The provisioning flow for a NEW school (scripts + env + seed + checklist)
  - The test plan: unit, integration, E2E and security tests mapped to PRD §15 acceptance criteria
  - Open questions for Altrastate (list them, do not guess silently)

Do NOT write application code in this session. Do not move on until I approve the spec.
```

---

## SECTION 1 — Product truth (what we're building, in one screen)

| Item | Decision |
|---|---|
| Product | Altrastate School: a premium institutional website, a no-code CMS and an online admissions portal |
| Tenancy | **Single-tenant per school.** One codebase, N independent deployments. No `school_id` column is needed for isolation; isolation comes from separate Supabase projects. |
| Users | Public visitors (no account), school staff with roles, Altrastate technical admins (restricted) |
| First release | Full PRD scope: 9 public modules, CMS, admissions, RBAC, 4 templates |
| Out of scope | SIS, fees, results, attendance, parent/student portals, payments, SMS (future modules, PRD §19). Design extension points but **do not build** them. |
| Locale | English (UK spelling in UI copy: "programme", "enrolment", "colour"). Timezone default `Africa/Kampala` (EAT, UTC+3), configurable per school. Phone format `+256`. Domains often `*.ac.ug` / `*.sc.ug`. |
| Primary device | **Mid-range Android phones on 3G/4G.** Every public-page decision is judged against this first. |

---

## SECTION 2 — Platform facts and overrides (verified Nov 2026)

These have changed since the PRD was drafted. Follow them exactly.

1. **Next.js 16.** `middleware.ts` is replaced by **`proxy.ts`** (exported function `proxy`, Node.js runtime). `params`/`searchParams` are async and must be awaited. Turbopack is the default bundler. Node ≥ 20.9. Caching is **explicit** through Cache Components (`cacheComponents: true`, the `'use cache'` directive, `cacheLife`, `cacheTag`, `revalidateTag`/`updateTag`). Nothing is cached by accident; we decide what is.
2. **⚠ SECURITY FLOOR.** React2Shell (CVE-2025-55182, CVSS 10, unauthenticated RCE in React Server Components) and its follow-ups (CVE-2025-55183/55184) affected Next 15.x/16.x. **Pin to the latest patched Next 16.x and React 19.2.x.** CI must fail on any `npm audit --audit-level=high` finding in `next`, `react`, `react-dom` or `react-server-dom-*`.
3. **⚠ OVERRIDE — Supabase API keys.** The legacy `anon` and `service_role` keys are deprecated by the **end of 2026**. Use the **publishable key** (`sb_publishable_…`) and the **secret key** (`sb_secret_…`). The env var names in PRD §21 are replaced (see Section 9).
4. **Supabase SSR auth.** Use `@supabase/ssr` only (never the old `auth-helpers`). Create two clients: `createBrowserClient` and an async `createServerClient` built on `await cookies()`. `proxy.ts` refreshes the session through `supabase.auth.getClaims()`. **Always protect pages and actions with `getClaims()` (which verifies the JWT), never with `getSession()`.** Authorisation is re-checked **inside every Server Action**, not only in the proxy.
5. **Caching + auth hazard.** Cookies cannot be read inside a `'use cache'` scope. **Never cache any response that sets cookies or depends on the user.** Public content is cached by tag. Admin pages are always dynamic.
6. **Vercel body limit.** Vercel Functions reject request bodies **over 4.5 MB** (Server Actions default to 1 MB). **All file uploads go browser → Supabase Storage directly** through `createSignedUploadUrl`, which is issued by a permission-checked Server Action. File bytes never pass through a Function.
7. **Tailwind v4.** No `tailwind.config.js`. Tokens live in CSS through `@theme inline`; `:root` and `.dark` sit at the root, not inside `@layer`. Use `tw-animate-css`. shadcn/ui is initialised for v4 with CSS variables.
8. **Tiptap v3.** Admin editor: `useEditor({ immediatelyRender: false, … })`. Store **ProseMirror JSON** in `jsonb`. Render public pages **on the server** with `@tiptap/static-renderer` using the same extension list. Never store base64 images (`allowBase64: false`); images go to the media library and are referenced by `media_assets.id`.
9. **Supabase regions.** Supabase has **no African region.** Pick the region closest to Kampala by measured latency (in practice an EU region such as Frankfurt or Ireland; test before deciding). Storing data outside Uganda triggers DPPA §19, so the admissions consent notice must say so (see Section 8).
10. **Supabase MCP for Claude Code** may be used **only** against a dev/branch project, always with `project_ref=…&read_only=true`. Never connect it to a school's production project.

---

## SECTION 3 — The customisation architecture (the core of "adjust to each customer")

The goal: **onboarding a new school is configuration + content, never code.** If a developer has to edit a `.tsx` file to onboard a school, the architecture has failed.

### 3.1 Three layers of customisation

| Layer | Where it lives | Who changes it | Examples |
|---|---|---|---|
| **A. Deployment identity** | Vercel env vars per project | Altrastate tech (at provisioning) | Supabase URL/keys, site URL, email sender domain, map key, `SCHOOL_SLUG` |
| **B. School configuration** | `site_settings` table (single row, typed `jsonb` validated by Zod) | Super Admin / School Admin in `/admin/appearance` and `/admin/settings` | Name, motto, logo, colours, fonts, template, nav, footer, homepage section order, contact details, admissions config, social links, timezone, feature toggles |
| **C. Content** | Module tables (`news_articles`, `events`, …) | Editors per their permissions | Articles, events, staff, programmes, gallery, resources, pages |

**Rule:** nothing school-specific appears in source code. That covers names, phone numbers, colours, copy and logos. Lint for it with a grep in CI for `ac.ug`, `+256` and hard-coded hex colours outside `src/features/templates/**`.

### 3.2 `site_settings` contract (single source of truth for branding)

Define in `src/features/cms/settings/schema.ts` and export the inferred TS type:

```ts
export const SiteSettings = z.object({
  identity: z.object({
    name: z.string().min(2), shortName: z.string().max(20), motto: z.string().optional(),
    logoMediaId: z.string().uuid().nullable(), faviconMediaId: z.string().uuid().nullable(),
    foundedYear: z.number().int().optional(), schoolType: z.enum(['nursery','primary','secondary','tertiary','international','mixed']),
    curricula: z.array(z.enum(['UNEB','Cambridge','IB','Other'])).default(['UNEB']),
  }),
  theme: z.object({
    template: z.enum(['institutional-classic','modern-academic','heritage-prestige','contemporary-community']),
    primary: HexColour, secondary: HexColour, accent: HexColour.optional(),
    fontHeading: FontKey, fontBody: FontKey,        // FontKey = allow-listed next/font families only
    radius: z.enum(['none','sm','md','lg']), density: z.enum(['comfortable','compact']),
  }),
  navigation: z.array(NavItem).max(10),            // label, href | pageId, visible, children[]
  homepage: z.array(HomeSection),                  // ordered; see 3.4
  footer: FooterConfig,
  contact: ContactConfig,                           // phones[], emails[], address, hours[], geo {lat,lng}, mapZoom
  social: z.array(SocialLink),
  admissions: AdmissionsConfig,                     // see §5.1
  seo: z.object({ defaultTitleTemplate: z.string(), defaultDescription: z.string().max(160), ogImageMediaId: z.string().uuid().nullable(), indexable: z.boolean() }),
  locale: z.object({ timezone: z.string().default('Africa/Kampala'), dateFormat: z.string().default('d MMM yyyy') }),
  features: z.object({ admissionsTracking: z.boolean(), contentApproval: z.boolean(), mfaRequiredForAdmins: z.boolean() }),
  attribution: z.object({ showAltrastateCredit: z.boolean() }),
});
```

- Store it as one row (`id = 1`, enforced by a check constraint) with a `version` column for optimistic concurrency.
- Read it through one cached function, `getSiteSettings()` (`'use cache'` + `cacheTag('site-settings')`). Every save calls `updateTag('site-settings')`.
- **Validate the contrast** of `primary`/`secondary` against white and near-black at save time. Reject combinations below the WCAG AA 4.5:1 text ratio and show the admin a plain-language warning with a suggested darker shade.

### 3.3 Template engine (PRD §8)

```
src/features/templates/
  registry.ts                  // template key → TemplateDefinition
  types.ts                     // TemplateDefinition, SectionRenderer contracts
  institutional-classic/  { tokens.css, Header.tsx, Footer.tsx, sections/*.tsx, preview.png }
  modern-academic/        { … }
  heritage-prestige/      { … }
  contemporary-community/ { … }
  shared/                      // section data loaders + skeletons used by ALL templates
```

- A `TemplateDefinition` = `{ key, label, description, Header, Footer, sections: Record<HomeSectionType, SectionComponent>, tokens, supportedSections }`.
- **Templates are pure presentation.** They receive typed data props. They never query the DB and never own content, which is how switching templates preserves data (PRD §8.3).
- Theme tokens are injected server-side as CSS variables on `<html>` (`--brand-primary` and so on) from `site_settings.theme`. Each template's `tokens.css` maps them to its own semantic tokens. There must be no runtime JS theming and no flash of unstyled theme.
- Fonts: preload an **allow-list** of `next/font/google` families (e.g. Inter, Source Serif 4, Playfair Display, Lora, Nunito Sans, Merriweather, DM Sans, Libre Baskerville). Admins choose from this list only and never type in an arbitrary font URL.
- **Template preview:** `/admin/appearance` renders a live preview in an iframe at `/preview/template/[key]`. That route is draft-mode-gated and noindexed, and renders the real homepage with the candidate template and unsaved theme values passed through a signed, short-lived preview token.
- Visual direction per template (original designs; the references are for quality level only, never copy):
  - **Institutional Classic:** a formal top bar with contacts, a centred crest, serif headings, a structured grid, restrained motion.
  - **Modern Academic:** large photography, generous whitespace, a sans-serif display face, subtle scroll-reveal (respecting `prefers-reduced-motion`).
  - **Heritage & Prestige:** an elegant serif, a history timeline section, prominent leadership, a muted heritage palette derived from the brand colours.
  - **Contemporary Community:** rounded cards, an events-first homepage, activity highlights, a warmer tone.

### 3.4 Homepage section registry (PRD §4.2, A–J)

```ts
type HomeSectionType =
  | 'hero' | 'introduction' | 'quickInfo' | 'latestNews' | 'upcomingEvents'
  | 'academicOverview' | 'galleryPreview' | 'admissionsCta' | 'leadershipMessage'
  | 'statistics' | 'testimonials' | 'customRichText';
type HomeSection = { id: string; type: HomeSectionType; visible: boolean; settings: Record<string, unknown> }; // settings validated per type
```

- Admins **reorder** these with drag and drop (dnd-kit, with keyboard-accessible reordering), **toggle visibility** and edit each section's settings in a side panel.
- The hero supports 1–5 slides (image or a muted, poster-backed video). Autoplay must be pausable (WCAG 2.2.2). The first slide image gets `priority`, and the others load lazily.
- Header (A) and footer (J) are configured separately in `navigation` and `footer`.

### 3.5 Provisioning a new school (must be scripted)

Create `scripts/provision-school.ts` and `docs/runbooks/new-school.md`:
1. Create a Supabase project (in the chosen region). Record the `project_ref`.
2. Run `supabase link --project-ref <ref>` and `supabase db push` to apply **all** migrations.
3. Run the seed: roles, permissions, `role_permissions`, default `site_settings`, default news, gallery and resource categories, default admissions statuses, Privacy Policy and Terms page stubs.
4. Create storage buckets with policies (Section 7.4).
5. Create a Vercel project from the same GitHub repo. Set the env vars (Section 9). Add the domain and set up DNS (+ `www` redirect).
6. In Resend, verify the school's sending domain (SPF, DKIM, DMARC). Set `EMAIL_FROM`.
7. Invite the first **Super Administrator** with a one-time invite link. **Never** send a password by email.
8. Run `npm run smoke -- --url https://<domain>`, a Playwright smoke suite against production.
9. Record the school in Altrastate's private `installations.json` registry (ref, domain, region, version, go-live date). That registry drives fleet upgrades.

---

## SECTION 4 — Repository & architecture

### 4.1 Structure (extends PRD §9.2)

```
src/
  app/
    (public)/            layout.tsx (template shell) · page.tsx · about/ · academics/ · admissions/ · news/ · events/ · gallery/ · staff/ · resources/ · contact/ · legal/ · [slug]/ (CMS pages)
    (auth)/              login/ · forgot-password/ · reset-password/ · accept-invite/ · mfa/
    admin/               layout.tsx (permission-aware sidebar) · overview/ · pages/ · news/ · admissions/ · academics/ · events/ · gallery/ · staff/ · resources/ · enquiries/ · media/ · appearance/ · users/ · settings/ · activity/
    api/                 webhooks/resend/ · cron/ (scheduled publish, retention) · health/
    preview/             template/[key]/ (draft-mode only)
    sitemap.ts · robots.ts · manifest.ts · opengraph-image.tsx
  proxy.ts
  features/<module>/     { schema.ts (Zod) · queries.ts (server-only reads) · actions.ts ('use server') · components/ · permissions.ts · __tests__/ }
  components/            ui/ (shadcn) · layout/ · shared/ (DataTable, ConfirmDialog, EmptyState, MediaPicker, RichTextEditor, StatusBadge)
  lib/                   supabase/{server.ts,browser.ts,admin.ts,proxy.ts} · auth/{require-permission.ts} · validation/ · email/ · security/{rate-limit.ts,sanitize.ts,file-validation.ts} · audit/ · cache/tags.ts · dates/
  emails/                React Email templates
  types/database.ts      generated: `supabase gen types typescript`
supabase/
  migrations/            timestamped SQL; the ONLY way to change schema
  seed.sql · tests/      pgTAP RLS tests
e2e/                     Playwright
docs/                    MASTER_PROMPT.md · PRD.pdf · plan/ · adr/ · runbooks/ · admin-guide/
```

### 4.2 Non-negotiable code rules

- **Server-first.** Pages are Server Components. `'use client'` goes only on interactive leaves (forms, editor, calendar, lightbox, dnd). Measure the client JS per public route; the budget is in Section 10.
- **Every mutation is a Server Action** following this exact pipeline:
  `parse(Zod) → requirePermission(perm) → rate-limit (public actions) → DB write (user-scoped client, RLS applies) → audit log → revalidate tags → typed Result`.
  Return `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`. Never throw raw errors to the client.
- **Three Supabase clients, with strict rules:**
  - `server.ts`: user-scoped and cookie-based; the default everywhere.
  - `browser.ts`: client components only, used for direct-to-storage uploads with signed tokens.
  - `admin.ts`: uses the **secret key**, `import 'server-only'`, and is allowed **only** in `api/cron/*`, `api/webhooks/*` and provisioning scripts. An ESLint `no-restricted-imports` rule enforces this.
- `import 'server-only'` goes in every `queries.ts`, `actions.ts` and `lib/supabase/server.ts`.
- **No `any`.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. DB types come from generated `types/database.ts`.
- **Dates:** store `timestamptz` in UTC and render in `site_settings.locale.timezone` using `date-fns-tz`. All-day events are stored as `date` (no timezone).
- **Slugs:** generated, unique per table, editable. Changing a slug writes a `redirects` row (old → new, 308) so links never break.
- **Soft delete** (`deleted_at`) for content. Hard deletes happen only through the retention job or an explicit Super Admin purge with confirmation.
- Architecture decisions are recorded as short ADRs in `docs/adr/NNN-title.md`.

---

## SECTION 5 — Module specifications (implementation detail beyond the PRD)

Each module ships with: a Zod schema, a migration, RLS, queries, actions, a public UI, an admin UI (list with search/filter/sort/pagination, plus a create/edit form with autosaved draft), audit logging and tests. **"Done" means all of these, not "the page renders."**

### Shared content-lifecycle (all publishable content)
- `status` enum: `draft | in_review | scheduled | published | archived`. Also `publish_at timestamptz`, `published_at`, `created_by`, `updated_by`, `version int`.
- `in_review` is used only when `features.contentApproval = true`. Then users without `publish` permission can only "Submit for review", and users holding `approve` publish (PRD §6.6).
- Scheduled publishing: a Vercel Cron (`/api/cron/publish`, every 5 min, authenticated by a `CRON_SECRET` header) flips due `scheduled` rows to `published` and calls `revalidateTag`.
- Public queries **always** filter `status = 'published' AND publish_at <= now() AND deleted_at IS NULL`. RLS enforces the same condition for the publishable-key role. That is defence in depth: the app filter is for performance and RLS is for security.
- Preview: authenticated editors open `/…?preview=<signed token>` through Next.js draft mode. The page shows a visible "PREVIEW — not published" banner and sends `X-Robots-Tag: noindex`.
- **Optimistic concurrency:** each update sends `version`, and a mismatch returns "Someone else edited this — reload to see their changes." This prevents two officers overwriting each other.

### 5.1 Admissions (PRD §5.1): highest-risk module, so build it most carefully
- **Configurable form:** `admissions_forms` holds the field definitions as JSON (type, label, required, options, help text, conditional visibility). The admin builder offers fixed field types: text, email, phone (+256 default, E.164 stored), date, select, radio, checkbox, textarea, file. Validation is **generated at runtime** from that definition into a Zod schema used on **both** client and server.
- **Intakes:** `admission_intakes` (e.g. "Senior One 2027 — Term 1") with open/close dates, the classes/levels offered, required documents, and a capacity that is informational only. The public form shows only open intakes; outside a window it shows the next opening date.
- **Multi-step form** (applicant → guardian → academic → medical (optional) → documents → review & consent). Each step validates. The **draft is saved to `localStorage`**, with an explicit "Your progress is saved on this device" message, because parents on mobile data drop off mid-form. Field labels must be clear to a parent, not an administrator.
- **Uploads:** each file is requested via action → `createSignedUploadUrl` into private bucket `admission-documents/{application_id}/{uuid}.{ext}` → uploaded directly from the browser → server confirms. Allowed types: PDF, JPEG, PNG, HEIC→JPEG. Limit: 10 MB per file (configurable), max 10 files. **Check magic bytes server-side** after upload by reading the first bytes; the extension alone proves nothing. Strip EXIF from images. On failure, delete the object.
- **Reference number:** `{SHORT}-{YYYY}-{6-char Crockford base32}` (e.g. `NAM-2027-7K3QX9`). It is generated in Postgres from a sequence plus a checksum character, and it is unique, unguessable and readable over the phone.
- **Tracking (when enabled):** `/admissions/track` takes the reference **plus** the guardian's email or phone, and is rate-limited. It shows the **status and the public messages only**, never internal notes and never documents.
- **Statuses:** the `admission_statuses` table is configurable (name, colour, `is_terminal`, `notify_applicant`, email template key). It is seeded with PRD §5.1's seven statuses. Each status change writes an `admission_status_history` row (from, to, by, at, public message, internal note).
- **Internal notes** live in a **separate table**, `admission_notes`, whose RLS grants access only to `admissions.view_notes`. They are never selected in the same query as public-facing data.
- **Exports:** CSV/XLSX of a filtered list. This needs the `admissions.export` permission and writes an audit log entry recording the row count and the filter used. Exports **exclude medical fields** unless the user also holds `admissions.view_medical`.
- **Reports:** totals by intake, class, status and date (a daily line chart), plus acceptance rate and pending age (median days in status). The charts use the brand colours with an accessible table fallback.
- **Notifications:** acknowledgement to the guardian, an alert to the admissions inbox, status-change emails (only where `notify_applicant`), additional-info requests (the guardian replies by uploading through a **single-use, expiring link** that needs no account).

### 5.2 News & announcements (PRD §5.2)
Categories are CRUD. There are featured flags (max N featured, enforced), a cover image with **required alt text**, an excerpt (generated from the body if empty, editable), reading time, scheduled publishing, archive, and search using Postgres full-text search (`tsvector` generated column + GIN index, `english` config) with category filter and pagination. Share buttons are plain `<a>` links to WhatsApp, Facebook, X, LinkedIn and email, with no third-party SDKs. **WhatsApp comes first**, because it is the dominant sharing channel for Ugandan parents. Structured data: `NewsArticle` JSON-LD.

### 5.3 Academics (PRD §5.3)
Configurable hierarchy: `academic_levels` (e.g. Nursery, Primary, O-Level, A-Level), then `academic_programmes`, then `departments`, `subjects`, and the many-to-many `programme_subjects`. Rich-text descriptions, curriculum tags (UNEB/Cambridge/IB), co-curricular activities and examination info pages. Nothing is hard-coded: a nursery school and an A-Level school must both fit.

### 5.4 Events calendar (PRD §5.4)
Fields: `starts_at`, `ends_at`, `all_day`, venue, optional map link, category, featured, cover image. Views: **agenda list (the default on mobile)**, month grid (desktop), and event detail. Past events are browsable by term or year. Each event offers an "Add to calendar" download (`.ics` generated server-side) and a Google Calendar link. Structured data: `Event` JSON-LD. Recurring events are out of scope for v1 (note it in an ADR); the admin can duplicate an event instead.

### 5.5 Gallery (PRD §5.6)
Albums with category, cover, date, published flag and ordering. Media: images uploaded to the public `media` bucket with **originals kept**, and delivery through `next/image` (AVIF/WebP, responsive `sizes`, a blur placeholder generated on upload and stored as `blurhash`/`lqip` on `media_assets`). Videos are **embed-only** (YouTube/Vimeo URL, validated against an allow-list) using a lite click-to-load facade, so the third-party player never loads until clicked. The lightbox is keyboard-navigable with focus trapping and captions. Bulk upload takes up to 50 images per batch with a per-file progress list and retry.

### 5.6 Staff directory (PRD §5.7)
Fields: photo, name, title, position, department(s), bio, qualifications, display order, `is_leadership`, and **per-field visibility toggles** (`show_email`, `show_phone`, default **off**), plus an archived flag. The public page groups staff as leadership first, then by department. Structured data: `Person` inside an `EducationalOrganization` → `employee`. **Staff profiles are not login accounts**; keep `staff_profiles` separate from auth `profiles`.

### 5.7 Contact (PRD §5.8)
Contact details come from `site_settings.contact`. The map is a **static map image with a "Open in Google Maps" directions link** by default, which is faster on mobile and needs no cookies or JS. An optional interactive map loads on click. The form fields are name, email, phone (optional), subject (select, configurable) and message (20–2,000 characters). It uses the anti-spam stack (Section 7.6), stores to `contact_messages`, emails the configured inbox and shows the visitor a confirmation. Admins see an enquiries inbox with statuses `new | read | replied | archived`, assignment and internal notes.

### 5.8 Resource centre (PRD §5.9)
Resources have title, description, category, file (public `resources` bucket), size, type, version history (replacing a file keeps the old version and makes the new one current), download count (incremented via a lightweight action, without exposing timing data), and `published`/`deleted`. Allowed types: PDF by default, plus DOCX/XLSX/PPTX if enabled in settings. **Anything private never goes in this bucket.**

### 5.9 Pages & CMS (PRD §6)
Pages have title, slug, parent (for nested About pages), Tiptap body, SEO overrides, `show_in_nav`, order, status and template layout variant (`default | wide | with-sidebar`). The media library (PRD §6.5) offers a grid/list view, search, filter by type/date, **required alt text before an image can be inserted**, "used in" references (prevents deleting in-use media; offers a replace instead) and replace-in-place that keeps the same id.

### 5.10 Admin dashboard (PRD §6.1)
The dashboard is **actionable, not decorative**: "3 applications waiting more than 7 days", "2 new enquiries", "Next event: Sports Day in 4 days", "1 draft scheduled for tomorrow", plus recent activity. Every tile links to a filtered list. The sidebar shows only the sections the user can access (PRD §6.2).

---

## SECTION 6 — RBAC (PRD §7)

- Tables: `roles`, `permissions` (key like `news.publish`), `role_permissions`, `user_roles(user_id, role_id)`, and `profiles(id → auth.users, full_name, status active|deactivated, last_login_at, mfa_enrolled)`.
- Permission keys follow `<module>.<action>` with modules `pages, news, academics, events, gallery, staff, resources, enquiries, admissions, media, appearance, settings, users, activity` and actions `view, create, edit, publish, delete, approve, export, manage`, plus the special keys `admissions.view_notes`, `admissions.view_medical` and `users.manage_roles`.
- Seed the seven PRD roles. Super Admin can create custom roles from the permission checklist. **Nobody can grant a permission they don't hold**, and **the last active Super Admin cannot be demoted or deactivated**. Both rules are enforced in SQL.
- **Single enforcement path:**
  - SQL: `public.has_permission(p text) returns boolean`. It is `language sql stable security definer set search_path = ''`, uses `(select auth.uid())` inside, and checks that `profiles.status = 'active'`.
  - App: `requirePermission(p)` calls `getClaims()`, then the same RPC, and throws a typed `ForbiddenError`. The UI hides what you can't do, **but the server is the only authority**.
- **Altrastate technical access:** a `platform_support` role that has **no** admissions, enquiry or notes permissions by default. Access to personal data needs a time-boxed grant by the school's Super Admin (`support_access_until timestamptz`), and every access is audited (PRD §3.4).
- **MFA:** Supabase TOTP MFA. It is optional by default, and when `features.mfaRequiredForAdmins` is on, RLS on sensitive tables additionally requires `(select auth.jwt()->>'aal') = 'aal2'`. **Recommend making it mandatory for Super Admin and Admissions Officer.**
- Account deactivation immediately revokes sessions (call `auth.admin.signOut(userId)` from a secure route) and blocks access through the `profiles.status` check in `has_permission`.

---

## SECTION 7 — Security (PRD §10) — treat as acceptance criteria

### 7.1 Threat model (write `docs/adr/001-threat-model.md`)
The assets are, in order: **children's personal data and documents**, admin accounts, school reputation (defacement) and email reputation. Main threats: IDOR on applications and documents, broken RLS, privilege escalation via crafted requests, stored XSS through rich text, spam/bot floods on public forms, credential stuffing, malicious uploads, secret leakage, and supply-chain vulnerabilities.

### 7.2 Database / RLS
- **RLS is enabled on every table in `public`, with no exceptions.** CI runs a pgTAP test that fails if any table lacks RLS or any policy uses a bare `auth.uid()` (it must be `(select auth.uid())` for the initPlan optimisation).
- Public (anon/publishable) access gets **SELECT only on published rows** of public content tables, plus **INSERT only** on `contact_messages` and `admissions` through **`security definer` RPCs** (`submit_enquiry`, `submit_application`). Those RPCs validate input, set server-controlled columns (status, reference, created_at) and return only the reference number. **The anon role has no direct INSERT on the base tables.**
- Index every column used in policies and FKs. Run Supabase **Security Advisor and Performance Advisor** in CI (through the Management API, or manually before each release) with zero errors.
- Security-definer functions live in a non-exposed `private` schema where possible, and always set `search_path = ''`.

### 7.3 pgTAP RLS test suite (`supabase/tests/`) — must include at minimum:
anonymous users cannot read drafts, notes, applications, enquiries, logs or profiles; a Content Editor cannot read admissions; an Admissions Officer without `view_notes` cannot read notes; a deactivated user can read nothing; a user cannot escalate their own role; nobody can update `activity_logs` (append-only, enforced by having no UPDATE/DELETE policy plus a trigger); `submit_application` rejects a client-supplied status or reference.

### 7.4 Storage
| Bucket | Public? | Contents | Access |
|---|---|---|---|
| `media` | public read | approved site images | write needs `media.create` |
| `resources` | public read | published downloads only | write needs `resources.create` |
| `admission-documents` | **private** | applicant files | read: `admissions.view` via **signed URL, 60-second expiry**, generated after the permission check, and each download is audited |
| `private-attachments` | **private** | enquiry attachments (if enabled) | same pattern |

Storage policies mirror the permission model. Paths are random UUIDs and must never contain names.

### 7.5 HTTP & app hardening
- Headers set in `next.config.ts`: a strict **CSP** (nonce-based for scripts; `frame-ancestors 'none'`; `img-src` allow-listing the Supabase storage domain and the map/video thumbnail hosts), `Strict-Transport-Security` (2 years, includeSubDomains, preload once stable), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables camera, mic and geolocation.
- **Rich text:** render server-side from JSON through the static renderer with a fixed extension allow-list, so there are no raw HTML nodes. Links get `rel="noopener noreferrer nofollow"` when they point outside the site. Embeds go through an allow-list (YouTube, Vimeo, Google Maps). Never use `dangerouslySetInnerHTML` on user content.
- Server Actions: Next's built-in origin check stays on. Set `serverActions.allowedOrigins` to the school's domain(s) only.
- Auth: Supabase leaked-password protection on, minimum password length 12, email confirmations on, invite-only sign-up (**public sign-up disabled**). Rate limits on login, reset and invite. Generic error messages ("Email or password is incorrect").
- Secrets: never use a `NEXT_PUBLIC_` prefix on secrets. Add a pre-commit hook (gitleaks or similar). Run `npm audit` and Dependabot/Renovate weekly.
- Logging: never log request bodies from the admissions or contact forms. Redact emails and phones in error tracking.

### 7.6 Anti-abuse on public forms (contact, admissions, tracking)
These are layered: **Vercel BotID** (`initBotId` in `instrumentation-client.ts` plus `checkBotId()` in the action), a **honeypot field**, a **minimum time-to-submit** (≥ 3 s), **Vercel WAF rate limiting** (or an Upstash-based limiter) per IP and per email, and a server-side length/content check. If BotID is unavailable on the plan, fall back to Cloudflare Turnstile. Do **not** use a visual CAPTCHA by default, because it hurts accessibility and mobile conversion.

### 7.7 Audit log (`activity_logs`)
Fields: actor, action, entity type/id, a before/after diff (with sensitive fields redacted), IP hash and timestamp. Log every publish, delete, status change, role change, login, failed login burst, export, document download, settings/appearance change and support-access grant. The admin UI offers filters and CSV export (`activity.export`). Retention is 24 months (configurable).

---

## SECTION 8 — Privacy & Uganda DPPA compliance (PRD §10.4)

> Engineering implements the controls. **The school is the data controller** and Altrastate is a **processor**, so a lawyer must review the legal texts. Build the hooks; don't draft legal conclusions.

- **Law:** Data Protection and Privacy Act, 2019 (Cap. 97) and the Data Protection and Privacy Regulations, 2021. Regulator: the **Personal Data Protection Office (PDPO)** under NITA-U. Each school (and Altrastate as processor) should **register with the PDPO**; add this to the go-live checklist in `docs/runbooks/new-school.md`.
- **Children's data (s.8):** admissions collect data about minors, so the form must be completed by a **parent/guardian**, with an explicit consent checkbox stating the relationship and the purpose. Record the consent as `consent_text_version`, `consented_at` and an IP hash.
- **Special personal data (s.9):** medical information is special data. The medical section is **optional, off by default** in `admissions_forms`, shown only if the school enables it, and access-gated behind `admissions.view_medical`.
- **Cross-border storage (s.19):** Supabase/Vercel host outside Uganda. The admissions and contact consent notices must say this clearly, and the privacy policy page must list the processors (Supabase, Vercel, Resend) and the regions.
- **Purpose limitation & minimisation:** collect only the fields the school configured. Gender is optional unless the school requires it (PRD §5.1).
- **Data subject rights:** an admin tool to export everything held about an applicant (JSON + files zip) and to **erase/anonymise** an application, logged with the reason.
- **Retention:** per-school settings, e.g. unsuccessful applications deleted N months after the intake closes, enquiries after N months. A nightly cron enforces them and logs a summary.
- **Breach notification:** `docs/runbooks/incident-response.md` with the PDPO notification steps, contacts and timelines.
- **Cookies:** the public site sets **no non-essential cookies** by default. Use privacy-friendly analytics (Vercel Web Analytics, which is cookieless), so no consent banner is needed. If a school adds tracking, a consent banner becomes mandatory.

---

## SECTION 9 — Environment configuration (⚠ OVERRIDES PRD §21)

`.env.example` (committed) and `src/lib/env.ts` (Zod-validated at boot; the build fails on missing vars):

```bash
# Identity
NEXT_PUBLIC_SITE_URL=https://www.schoolname.ac.ug
SCHOOL_SLUG=schoolname                      # used for logs, storage prefixes, registry
# Supabase (new key model — legacy anon/service_role keys are deprecated end of 2026)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...            # server-only; only lib/supabase/admin.ts may read it
# Email
RESEND_API_KEY=
EMAIL_FROM="School Name <no-reply@schoolname.ac.ug>"
EMAIL_ADMISSIONS_INBOX=
RESEND_WEBHOOK_SECRET=
# Maps (static map + optional interactive)
NEXT_PUBLIC_MAP_PROVIDER=google|maptiler|osm
NEXT_PUBLIC_MAP_PUBLIC_KEY=                 # restricted by HTTP referrer to the school domain
# Ops
CRON_SECRET=
PREVIEW_TOKEN_SECRET=
SENTRY_DSN=                                  # optional
```

Keep separate Vercel environments (Development / Preview / Production) and separate Supabase projects for dev and each school's production. **Preview deployments never point at a production Supabase project**; use a Supabase branch or a shared staging project with fake data.

---

## SECTION 10 — Performance, accessibility, SEO budgets (PRD §5.5, §11)

### Performance (test on a throttled "Slow 4G, mid-tier Android" profile)
- Core Web Vitals at p75: **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1** on the homepage, news article, admissions form and gallery album.
- **First-load client JS ≤ 120 KB gzipped** on public routes; the admin can be heavier.
- The hero image is ≤ 200 KB as AVIF at mobile width. Every image goes through `next/image` with `sizes`. No image is shipped above 2× the display size.
- Fonts: at most 2 families and 4 weights, via `next/font` (self-hosted, `display: swap`).
- Public pages use Cache Components: static shells with cached data (`cacheLife('hours')`) invalidated **on publish** through tags (`news`, `news:<slug>`, `events`, `site-settings`, and so on). Content updates show **within seconds of publishing** without a redeploy.
- No third-party scripts on initial load (maps, video and social embeds are click-to-load facades).
- Lighthouse CI in GitHub Actions on preview deployments, with a performance ≥ 90 / a11y = 100 / best-practices ≥ 95 / SEO = 100 gate on key routes.

### Accessibility — WCAG 2.2 AA (PRD §11.2)
Semantic landmarks, one `h1` per page and a logical heading order, a skip link, visible focus (`:focus-visible`, ≥ 3:1), **target size ≥ 24×24 px (2.5.8)**, no keyboard traps, focus not obscured by sticky headers (2.4.11), accessible names on icon buttons, form errors announced (`aria-live`) and linked through `aria-describedby`, **no re-entry of data already given in multi-step admissions (3.3.7 Redundant Entry)**, accessible authentication with paste allowed and no cognitive tests (3.3.8), drag-and-drop alternatives for reordering (2.5.7), `prefers-reduced-motion` respected, and contrast checks on the admin-chosen brand colours (Section 3.2). Run automated checks with `@axe-core/playwright` on every E2E page plus a **manual keyboard + screen-reader pass** (NVDA + Chrome, TalkBack on Android) before each release.

### SEO (PRD §11.3)
`generateMetadata` on every route draws from page SEO fields, falling back to settings. There are canonical URLs, `sitemap.ts` (dynamic: pages, news, events, albums, staff, resources), `robots.ts` (disallow `/admin`, `/preview`, `/api`; whole-site noindex if `seo.indexable = false` for pre-launch), an OG image per article/event via `opengraph-image.tsx` and the template's branding, and JSON-LD: **`School`/`HighSchool`/`ElementarySchool` (subtypes of `EducationalOrganization`)** with address, geo, phone, logo and sameAs social links on the homepage, plus `NewsArticle`, `Event`, `BreadcrumbList` and `Person`. Old URLs from a school's previous website can be imported into the `redirects` table at onboarding (CSV upload in settings).

---

## SECTION 11 — Admin UX principles (PRD §6.7) — the product's real differentiator

The test user is **a school bursar or secretary on a shared desktop, or an older Android tablet, with intermittent internet, who has never used a CMS.**

- **Plain language everywhere.** "Publish to website", not "Set status: published". "Hide from website", not "Unpublish". "Photo description (for blind visitors and Google)", not "Alt text".
- Every form shows a **save-state indicator**: "All changes saved", "Saving…" or "Not saved — check your connection". Autosave drafts every 10 s. A `beforeunload` warning on unsaved changes.
- **Destructive actions** need a confirm dialog naming the item ("Delete 'Sports Day 2026'? This can be undone from Trash for 30 days."). Deleted items go to a Trash view restorable for 30 days.
- **Empty states teach:** "No events yet. Add your first event — it will appear on the homepage calendar."
- **Inline help** with "?" popovers and a link to the matching admin-guide page.
- Image upload: drag-drop or tap, client-side resize to a 2,560 px max before upload (saves the school's data bundle), progress bars, and plain error messages ("This file is 18 MB. The limit is 10 MB. Try a smaller photo.").
- Tables: search, filters as chips, sorting, pagination of 25, bulk actions (publish/hide/delete) where safe, and responsive card layout below 768 px.
- Toasts announce results (`aria-live="polite"`). Errors never show stack traces.
- The admin UI uses **Altrastate's brand** (Midnight Blue `#0B1F3A`, Electric Cyan `#00C2FF`, Light Gray `#F5F7FA`), with the cyan reserved for accents/focus, never for text on white (it fails contrast). The **public site uses the school's brand, never Altrastate's** (PRD §22.2).
- **Usability acceptance (PRD §13.2):** script the four PRD tasks as moderated tests with a real school staff member. Each must be completed unaided in under 5 minutes.

---

## SECTION 12 — Phase prompts (paste one per session, after Section 0's spec is approved)

Each phase ends with this **Definition of Done**, which Claude Code must report against item by item with evidence (test output, screenshots, command output), not assertions:

> ☐ migrations committed and applied cleanly to a fresh DB · ☐ RLS + pgTAP tests pass · ☐ Zod schemas shared client/server · ☐ every action calls `requirePermission` · ☐ unit + integration tests pass · ☐ Playwright E2E for the phase's critical flows pass, including axe checks · ☐ `npm run typecheck && npm run lint && npm run build` are clean · ☐ audit log entries written · ☐ admin-guide page(s) written in `docs/admin-guide/` · ☐ `docs/plan/progress.md` updated · ☐ no TODOs left without an issue link

**Phase 0 — Spec** → Section 0 above.

**Phase 1 — Foundation & design system**
```
Implement Phase 1 per docs/plan/00-technical-spec.md and MASTER_PROMPT §2, §4, §10, §11.
Scaffold Next.js 16 (TS strict, App Router, src/, Turbopack), Tailwind v4 (@theme inline),
shadcn/ui, ESLint + Prettier, Vitest, Playwright + @axe-core/playwright, Husky + lint-staged +
gitleaks, src/lib/env.ts (Zod), security headers + nonce CSP, GitHub Actions CI
(typecheck, lint, unit, build, npm audit gate). Build the token layer that turns
site_settings.theme into CSS variables, and the admin shell layout in Altrastate branding.
Write ADR-000 (stack) and ADR-001 (threat model). Plan first; wait for my approval.
```

**Phase 2 — Database, auth, RBAC, security foundation**
```
Implement Phase 2: all migrations for the core tables, roles/permissions seed, has_permission(),
profiles, invite-only auth flows (login, reset, accept-invite, optional TOTP MFA), proxy.ts
session refresh with getClaims(), requirePermission(), the three Supabase clients with the
ESLint import guard, storage buckets + policies, activity_logs (append-only), and the full pgTAP
RLS suite from MASTER_PROMPT §7.3. Prove each RLS test fails before the policy exists and passes
after. Use the Supabase MCP only against the dev project, in read-only mode.
```

**Phase 3 — Public shell & template engine** → MASTER_PROMPT §3.3–3.4. Build all 4 templates' Header/Footer/section components against seeded demo content, plus the `/preview/template/[key]` route. Done when switching templates changes nothing in the DB (prove it with a test that snapshots row counts and checksums before and after).

**Phase 4 — CMS core** → admin dashboard, permission-aware sidebar, pages module, Tiptap editor + static renderer, media library with required alt text, the content-lifecycle state machine, autosave, optimistic concurrency, preview/draft mode, Trash, scheduled-publish cron.

**Phase 5 — Homepage & institutional pages** → the homepage section registry with drag-and-drop ordering, the appearance screen (logo, colours with contrast validation, fonts, template switch with preview), About subpages and Legal pages.

**Phases 6–11 — Modules** (one per session, in PRD order): News → Academics → Events → Gallery → Staff → Resources + Contact. Each follows MASTER_PROMPT §5.x exactly.

**Phase 12 — Admissions** (MASTER_PROMPT §5.1 and §8). Split it into sub-sessions: (a) schema/RLS/RPC + reference generator, (b) form builder + intakes, (c) public multi-step form + direct uploads, (d) admin review/status/notes/exports/reports, (e) emails + tracking + additional-info links. Add security tests for IDOR on documents and on tracking lookups.

**Phase 13 — Users, governance, reporting** → user invites/deactivation, custom roles, last-Super-Admin guard, the support-access grant, activity log UI/export, retention settings + cron, DSR export/erase tools.

**Phase 14 — Integrations, hardening, optimisation** → Resend domain + webhooks (bounce/complaint handling, delivery status shown on the application), retry with backoff for failed emails, BotID/WAF/rate limits, Lighthouse CI gates, the axe sweep, a manual screen-reader pass checklist, the cross-browser matrix (Chrome, Edge, Firefox, Safari iOS, Samsung Internet), Supabase Advisors clean, a dependency audit, and an OWASP ASVS L2 checklist review written to `docs/security/asvs-review.md`.

**Phase 15 — Acceptance & go-live** → map every PRD §15 criterion to a test or an evidence artefact in `docs/acceptance/matrix.md`. Production provisioning through `scripts/provision-school.ts`, a backup **restore drill** (restore into a scratch project and verify), admin training deck/guide, handover package (PRD §17.3), and secure credential transfer (never in docs or email).

---

## SECTION 13 — Fleet operations (many schools, one codebase) (PRD §16)

- **Versioning:** SemVer tags on `main` with a `CHANGELOG.md`. Each school's Vercel project tracks a **release branch or tag**, not `main` directly, so schools upgrade deliberately (PRD §16.4).
- **Migrations:** they are forward-only and **backward-compatible across one release** (expand → migrate → contract), so the app and DB can be deployed in either order.
- **Fleet upgrade workflow** (`.github/workflows/fleet-upgrade.yml`, manual trigger with a list of schools): for each school in `installations.json`, take a backup snapshot, run `supabase db push --project-ref`, promote the Vercel deployment, run the smoke suite, then record the version. Halt the fleet on the first failure.
- **Monitoring:** Vercel Observability plus Sentry (optional) per project, a `/api/health` endpoint that checks DB and storage reachability (no secrets in the output), uptime checks per domain, and alerts to Altrastate support.
- **Backups:** Supabase daily backups (enable PITR on paid plans for schools that need it), plus a weekly logical dump of each school DB to Altrastate-controlled storage (encrypted). A **restore test every quarter**, documented.
- **Cost guardrails:** document the per-school cost (Vercel plan, Supabase plan, Resend volume) in `docs/runbooks/costs.md`, and keep media originals in check with a 2,560 px client-side resize.

---

## SECTION 14 — Working agreement for Claude Code

1. **Plan before code** for anything bigger than one file. Write the plan to `docs/plan/phase-NN.md` and wait for approval.
2. **Test-first for security-critical logic** (RLS, permissions, admissions RPCs, reference generation, upload validation): write failing tests, then implement.
3. **Verify, don't assert.** Before saying "done", run typecheck, lint, tests and a build, and paste the summarised output. For UI, run Playwright and attach screenshots at 360 px and 1,280 px.
4. **Small, reviewable commits** (Conventional Commits). One feature per branch, plus a PR with a checklist.
5. **Ask when the PRD is ambiguous.** Record the question and the decision in `docs/adr/`. Never silently invent business rules about admissions, grading or data retention.
6. **Never:** disable RLS "temporarily", use the secret key in request-path code, cache user-specific responses, put school-specific values in code, store files in the DB, log personal data, or mark a feature done because its UI renders.
7. After each phase, update `CLAUDE.md` with any new convention or gotcha learned, keeping it short.

---

## SECTION 15 — Open questions to raise with Altrastate (Phase 0 output must include these)

1. Which Vercel and Supabase **plan tier** per school (this affects BotID Deep Analysis, PITR backups, WAF rules and cron frequency)?
2. Who owns each school's Vercel/Supabase accounts: Altrastate (managed) or the school (handover)? This changes provisioning and credential transfer.
3. Is the **medical section** required for any launch school? If so, a DPPA special-data review is needed first.
4. **Approval workflow** default: on or off for launch schools?
5. Default **retention periods** for unsuccessful applications and enquiries?
6. Is **Luganda or other language** support needed in v1 (it affects the i18n architecture now, even if only English ships)?
7. Will any school need **SMS notifications** at launch (Africa's Talking or similar)? This is listed as future in the PRD, but parents often prefer SMS to email.
8. Branding for the four templates: do Altrastate designers supply mockups, or should Claude Code generate original designs from §3.3's direction for review?
