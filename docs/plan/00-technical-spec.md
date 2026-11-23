# Altrastate School — 00 Technical Specification

| | |
|---|---|
| Status | **APPROVED 23 Nov 2026.** Open questions run on provisional defaults; see `docs/plan/00-decisions.md`. |
| Date | 22 Nov 2026 |
| Binding inputs | `CLAUDE.md`, `docs/MASTER_PROMPT.md` (cited as **MP §n**), `docs/PRD.pdf` (cited as **PRD §n**) |
| Precedence | MP over PRD (MP §0). This spec refines both. Where it adds to or departs from MP, the item is tagged **[EXT]** (an extension the spec needed) or **[DEV]** (a deliberate deviation, with its reason). Approving this spec approves every [EXT] and [DEV]. |

> **PRD reconciled (23 Nov 2026).** `docs/PRD.pdf` (v1.0, 41 pages) has been read in full and every former [PRD-CHECK] assumption replaced; see §0.1. MP still wins where MP and PRD conflict (MP §0); each such case is listed in §0.1.

## Contents
1. Database schema
2. Permission model & matrix
3. RLS policies (SQL)
4. Server Actions & Route Handlers
5. Page-by-page requirements
6. Template/theme contract & homepage section registry
7. Provisioning a new school
8. Test plan
9. Open questions for Altrastate
10. ADRs to be written & phase mapping

---

## 0. Cross-cutting decisions this spec makes

| # | Decision | Why |
|---|---|---|
| D1 | **Three Postgres schemas.** `public` is exposed through PostgREST: tables plus the few RPCs the app calls. `private` is not exposed: security-definer helpers, sequences, secrets lookups, rate-limit buckets. `extensions` holds `citext`, `pgcrypto`, `pg_trgm`, `pgtap` (tests only). | MP §7.2: definer functions go in a non-exposed schema where possible. |
| D2 | **Uniform content-lifecycle columns** on every publishable table, enforced by one generic trigger `private.content_lifecycle_guard(module)`. | One state machine, one RLS pattern, one set of tests. |
| D3 | **Optimistic concurrency** through `version int`. The app issues `update … where id = $1 and version = $2`. The trigger sets `new.version = old.version + 1`. Zero affected rows → `CONFLICT` result. | MP §5 shared lifecycle. |
| D4 | **Autosave goes to a working copy** (`content_drafts`), never to the live row. Editors' half-typed changes to a published article are never public. "Save draft" / "Publish to website" applies the working copy to the row. | MP §5 requires autosave every 10 s. Writing autosaves into the live row would publish unfinished edits. **[EXT]** |
| D5 | **Public forms are protected from direct RPC calls.** The publishable key is public, so anyone could call `submit_enquiry` / `submit_application` directly and skip BotID, the honeypot and rate limits. Each public RPC therefore requires an **HMAC "submission ticket"**. The Server Action mints it only after the anti-abuse checks pass: `HMAC-SHA256(FORM_SIGNING_SECRET, purpose‖payload_sha256‖issued_at)`, valid for 120 s and single-use. The RPC verifies it against the same secret, stored in Supabase Vault. | Closes a bypass that MP §7.6 doesn't address. Needs one new env var. **[EXT]** |
| D6 | **Public document uploads without the secret key.** The admissions form asks the `request_admission_upload` RPC (ticket-gated) for an **upload slot**. That inserts an `application_documents` row with `state = 'pending'`, a random path and `expires_at = now() + 30 min`, and returns the path. The anon Storage policy allows `INSERT` / `SELECT` / `UPDATE` / `DELETE` on `admission-documents` **only** for an object whose name matches a pending, unexpired slot. After that, the server-side confirm step (anon client) reads the first bytes (magic number), strips EXIF with `sharp` and re-uploads (upsert). It then marks the slot `uploaded` through `confirm_admission_upload` (ticket-gated). Once a slot is not pending, anon access ends. | Honours CLAUDE.md: `admin.ts` stays out of request paths, and bytes go browser → Storage. The exposure window is 30 min on an unguessable UUID path that only the uploader knows. Recorded in ADR-004. **[EXT]** |
| D7 | **A fourth Supabase factory**: `createPublicClient()` in `lib/supabase/server.ts`. It is cookie-less, uses the publishable key and has `persistSession: false`. It is the **only** client allowed inside `'use cache'` scopes. | Cookies can't be read in `'use cache'` (MP §2). This is not a new privilege level; it has the same role as an anonymous visitor. **[EXT]** |
| D8 | **Email dispatch through a queue.** Actions insert `email_messages` rows through RPCs. `after()` pokes `POST /api/cron/email-dispatch` (CRON_SECRET), which sends through Resend using `admin.ts`. A cron sweep every 5 min retries with backoff. | The anon path can't update delivery state. This keeps the secret key inside `api/cron/*` (CLAUDE.md), and retry/backoff comes for free (MP Phase 14). |
| D9 | **Rate limiting in two layers.** Layer 1 is a Vercel WAF rule (per IP, on `/admissions`, `/contact`, `/admissions/track`, `/login`). Layer 2 is a Postgres limiter `private.rate_limit_hit(key, max, window)` called *inside* the ticket-gated RPCs and the login/reset actions. Keys are `ip:<hash>`, `email:<hash>`, `ref:<hash>`. | No extra vendor (no Upstash), and the limiter works even if the WAF tier is unavailable (open question Q1). |
| D10 | **IP hashing**: `ip_hash = HMAC-SHA256(IP_HASH_SALT, ip)`, truncated to 16 bytes and hex-encoded. The salt is per deployment and stored in Vault. The raw IP is never stored. | MP §7.7, DPPA minimisation. |
| D11 | **All-day events** store `start_date` / `end_date` (`date`, no timezone). Timed events store `starts_at` / `ends_at` (`timestamptz`). A CHECK constraint makes them mutually exclusive. | MP §4.2. |
| D12 | **Slug changes** write `redirects` rows from the lifecycle trigger: old path → new path, 308. Chains are collapsed (A→B, B→C becomes A→C, B→C). | MP §4.2. |

### 0.1 PRD reconciliation

| PRD | What the PRD says | Effect on this spec |
|---|---|---|
| §7 roles | Super Administrator, School Administrator, Headteacher / Director, Admissions Officer, Content Editor, Events Manager, Read-only Staff | Seed roles replaced (§2.1). The earlier assumed `content_manager`, `admissions_reviewer` and `viewer` roles are dropped. |
| §5.1 statuses | Submitted, Under Review, Additional Information Required, Shortlisted, Accepted, Rejected, Withdrawn | Seed replaced (§1.10). |
| §4.2 A | The header includes **search functionality** | **New:** site-wide search, `/search` plus a header search box, using Postgres FTS over pages, news, events and resources (§1.4, §5.1). |
| §5.1 form fields | Nationality, previous school, guardian **physical address**, previous academic information, additional comments; medical "where required" | Seeded into the default form v1 as configurable fields (in `answers`). Core columns are unchanged. Medical stays off by default (MP §8). |
| §5.1 public | "Access downloadable admission forms where required" | Done through the resource centre: an intake can link to resources (`admission_intakes.resource_ids uuid[]`). |
| §5.1 notifications | "Email delivery should be configurable and monitored" | Already covered by D8, `email_messages` and the Resend webhooks. Delivery status is shown on the application and on the dashboard. |
| §5.3 | Learning approaches, academic policies, examination information, curriculum | CMS pages under the `academics` page root (system pages `curriculum`, `exam-info`). `/academics/subjects` is added as a listing route. |
| §5.6 gallery | "Upload **or** embed videos"; "Feature selected images" | **MP §5.5 wins:** videos are embed-only (Q23 confirms). `gallery_items.featured boolean` is added, and the homepage gallery preview can use the featured images. |
| §5.8 contact | Telephone "if required" | `contact.phoneRequired boolean` is added to the settings. |
| §6.1 dashboard | Totals: published news, applications, pending applications, upcoming events, published resources, recent enquiries, recent activity | Added as count tiles beside the MP §5.10 action tiles (§5.4). |
| §6.4 editor | Headings, paragraphs, bold/italic, lists, links, images, **tables**, **text alignment**, embedded media where approved | Tiptap extension allow-list: StarterKit (no code blocks), Link, Image (media id), Table family, TextAlign, and an allow-listed Embed node (YouTube/Vimeo/Google Maps). The same list is used by the static renderer. |
| §6.5 media | Image **and document** uploads, previews, file names, upload dates | `media_kind` already includes `document`. Documents in the media library are restricted to PDF (public bucket), and the preview is a first-page thumbnail (Q24). |
| §6.6 workflow | Draft → Preview → Publish; optional approval (one user creates, another approves) | Matches §2.3. The Headteacher holds `approve`. |
| §9.3 entities | `gallery_media`, `admissions`, `admission_documents` | Named `gallery_items`, `applications` and `application_documents` here. The names are clearer, and PRD §9.3 says the "exact schema should be finalised". This mapping is recorded in ADR-014. |
| §12.1 | "Important school announcements where configured" by email | **Not in v1 by default:** it needs a subscriber list with consent. See Q25. |
| §13.2 usability | Four tasks: (1) a non-technical admin publishes an announcement; (2) an admissions officer finds and processes an application; (3) a visitor submits an enquiry on a smartphone; (4) a school admin changes a homepage image unaided | §8.6. |
| §15 | 36 acceptance criteria across public, CMS, admissions and technical | Mapped one by one in §8.6. |
| §17.1 / §17.3 | Admin guide topics; handover package | §7.3 and §7.5. |
| §20 sitemap | About: School Overview, History, Vision and Mission, Core Values, Leadership. Admissions: Information, Requirements, Application Process, Apply Online, Tracking | The seed creates these as system pages (§7.2 step 7), and the routes match (§5.1). |
| §21 env | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAP_PROVIDER_KEY` | **MP §9 overrides:** use the new key model and `NEXT_PUBLIC_MAP_PUBLIC_KEY`. |

---

## 1. Database schema

Conventions for every table unless stated otherwise:
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. `updated_at` is maintained by the `private.touch_updated_at()` trigger.
- Every FK column has a b-tree index. Every column referenced in an RLS policy is indexed.
- Text columns that hold slugs carry `check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) <= 120)`.
- `citext` is used for emails.

### 1.0 Enums

```sql
create type public.content_status   as enum ('draft','in_review','scheduled','published','archived');
create type public.profile_status   as enum ('invited','active','deactivated');
create type public.enquiry_status   as enum ('new','read','replied','archived');
create type public.page_layout      as enum ('default','wide','with_sidebar');
create type public.media_kind       as enum ('image','document');
create type public.curriculum       as enum ('UNEB','Cambridge','IB','Other');
create type public.video_provider   as enum ('youtube','vimeo');
create type public.gallery_item_kind as enum ('image','video');
create type public.upload_state     as enum ('pending','uploaded','rejected','expired');
create type public.document_review  as enum ('unreviewed','accepted','rejected');
create type public.email_status     as enum ('queued','sending','sent','delivered','bounced','complained','failed','suppressed');
create type public.redirect_source  as enum ('slug_change','import','manual');
create type public.log_source       as enum ('app','db','cron');
```

### 1.1 Shared content-lifecycle column set ("LC")

Every table marked **+LC** carries these columns:

| Column | Type | Notes |
|---|---|---|
| `status` | `content_status not null default 'draft'` | |
| `publish_at` | `timestamptz` | Required when `status in ('scheduled','published')`. CHECK. |
| `published_at` | `timestamptz` | First time it went live. Set by trigger. |
| `created_by` | `uuid references public.profiles(id) on delete set null` | Set by trigger from `(select auth.uid())`. |
| `updated_by` | `uuid references public.profiles(id) on delete set null` | Set by trigger. |
| `deleted_at` | `timestamptz` | Soft delete. In Trash for 30 days, then purged by the retention cron. |
| `deleted_by` | `uuid references public.profiles(id) on delete set null` | |
| `version` | `int not null default 1` | Optimistic concurrency (D3). |

Constraint: `check (status not in ('scheduled','published') or publish_at is not null)`.
Partial index: `create index on <t> (publish_at desc) where status = 'published' and deleted_at is null;`

### 1.2 Identity, RBAC, support access

**`profiles`** — one row per staff auth user. Created by the `on_auth_user_created` trigger, which is only reachable through invite because public sign-up is disabled.

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, FK → `auth.users(id)` on delete cascade |
| full_name | text | not null, 2–120 chars |
| email | citext | not null, unique (mirror of auth email; synced by trigger) |
| status | profile_status | not null default `'invited'`; becomes `active` on accept-invite |
| last_login_at | timestamptz | |
| mfa_enrolled | boolean | not null default false (synced from `auth.mfa_factors` by trigger) |
| deactivated_at / deactivated_by | timestamptz / uuid FK profiles | |
| created_at / updated_at | | |

Index: `(status)`.

**`roles`** — id, `key text unique not null` (`^[a-z_]{3,40}$`), `name text not null`, `description text`, `is_system boolean not null default false` (system roles can't be deleted or renamed), `created_by`, timestamps.

**`permissions`** — `key text primary key` (`^[a-z_]+\.[a-z_]+$`), `module text not null`, `action text not null`, `description text not null` (plain language, shown in the custom-role checklist), `is_sensitive boolean not null default false` (personal data; drives the platform-support rules).

**`role_permissions`** — `role_id uuid FK roles on delete cascade`, `permission_key text FK permissions on delete cascade`, PK `(role_id, permission_key)`. Index `(permission_key)`.

**`user_roles`** — `user_id uuid FK profiles on delete cascade`, `role_id uuid FK roles on delete restrict`, `granted_by uuid FK profiles`, `granted_at timestamptz default now()`, PK `(user_id, role_id)`. Index `(role_id)`.

**`support_access_grants`** **[EXT]** — the source of truth for Altrastate's temporary access to personal data (MP §6). `profiles.support_access_until` from MP is replaced by this table, which also keeps history.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| grantee_id | uuid FK profiles | must hold the `platform_support` role (trigger) |
| granted_by | uuid FK profiles | must be super_admin (trigger) |
| permission_keys | text[] not null | subset of sensitive permissions, e.g. `{admissions.view}` |
| reason | text not null | 10–500 chars |
| starts_at | timestamptz not null default now() | |
| expires_at | timestamptz not null | `check (expires_at > starts_at and expires_at <= starts_at + interval '7 days')` |
| revoked_at / revoked_by | | |

Index `(grantee_id, expires_at)`.

### 1.3 Settings, redirects, drafts, media

**`site_settings`** — `id smallint primary key default 1 check (id = 1)`, `data jsonb not null` (validated by Zod `SiteSettings` in the app *and* by a DB check, `jsonb_typeof(data->'identity') = 'object'` etc., as a coarse guard), `version int not null default 1`, `updated_by`, `updated_at`.

Extensions to the MP §3.2 contract **[EXT]**. Each is needed by a module MP specifies:

```ts
contact:    { …, enquirySubjects: string[] /* 1–12, default ['General enquiry','Admissions','Fees','Other'] */,
                 enquiryInboxEmail: string /* falls back to env */ },
content:    { maxFeaturedNews: number /* 1–6, default 3 */, allowOfficeDocs: boolean /* default false */ },
retention:  { unsuccessfulApplicationsMonths: number | null, enquiriesMonths: number | null,
              activityLogMonths: number /* default 24 */, emailLogMonths: number /* default 12 */,
              trashDays: number /* default 30 */ },   // null = not yet decided → cron does nothing and the dashboard warns (Q5)
legal:      { privacyPageId: uuid | null, termsPageId: uuid | null, consentTextVersion: string },
```

`AdmissionsConfig` (MP §3.2 references "§5.1" without defining it):

```ts
AdmissionsConfig = z.object({
  enabled: z.boolean(),
  referencePrefix: z.string().regex(/^[A-Z]{2,4}$/),          // "NAM" in NAM-2027-7K3QX9
  inboxEmail: z.string().email().optional(),                  // overrides EMAIL_ADMISSIONS_INBOX
  maxFileSizeMb: z.number().int().min(1).max(20).default(10),
  maxFiles: z.number().int().min(1).max(10).default(10),
  acknowledgementMessage: z.string().max(600),                // shown on the success screen + email
  closedMessage: z.string().max(600),
  pendingAlertDays: z.number().int().min(1).max(60).default(7), // dashboard "waiting more than N days"
  infoRequestLinkDays: z.number().int().min(1).max(30).default(7),
});
```

**`site_settings_private`** **[EXT]** — `id smallint PK check (id = 1)`, `data jsonb not null` (Zod `PrivateSettings`: `admissionsInboxEmail`, `enquiryInboxEmail`, `retention` block, `consentTextDrafts`), `version`, `updated_by`, `updated_at`. Keeps internal addresses and retention configuration out of the publicly readable `site_settings` row. (So the `inboxEmail` / `enquiryInboxEmail` / `retention` fields listed above live here, not in the public row.)

**`redirects`** — id, `from_path text unique not null` (`check (from_path ~ '^/[^?#]*$')`), `to_path text not null`, `status_code smallint not null default 308 check (status_code in (301,302,307,308))`, `source redirect_source not null`, `created_by`, `created_at`. Read by `proxy.ts` through a cached map (`cacheTag('redirects')`).

**`content_drafts`** (D4) — `entity_type text`, `entity_id uuid`, `data jsonb not null`, `base_version int not null` (the row version the working copy was based on), `updated_by`, `updated_at`, PK `(entity_type, entity_id)`. When a new item has never been saved, the row is created first as `status='draft'` and drafts point at it.

**`media_assets`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | stable across replace-in-place |
| kind | media_kind | |
| bucket | text | `check (bucket in ('media','resources'))` |
| path | text unique | `{uuid}/{uuid}.{ext}`; never a human name |
| original_filename | text | shown in the admin only; sanitised; max 200 |
| mime_type | text | allow-list check |
| size_bytes | bigint | `check (size_bytes > 0)` |
| width, height | int | images |
| alt_text | text | max 250; **required before use** (see `media_usages` trigger) |
| caption | text | max 500 |
| lqip | text | ≤ 1 KB base64 blur placeholder (generated server-side on confirm) |
| blurhash | text | |
| uploaded_by | uuid FK profiles | |
| replaced_at | timestamptz | |
| deleted_at, deleted_by | | soft delete; blocked while used |
| version | int | |

Indexes: `(kind, created_at desc)`, a trigram index on `original_filename || ' ' || coalesce(alt_text,'')` for search.

**`media_usages`** — `media_id uuid FK media_assets on delete restrict`, `entity_type text`, `entity_id uuid`, `field text` (e.g. `cover`, `body`, `hero.slides[2]`), PK `(media_id, entity_type, entity_id, field)`. Index `(entity_type, entity_id)`. Rebuilt by the app on every save of the owning entity (Tiptap JSON is walked for `image` nodes). The trigger `private.media_usage_requires_alt` raises `ALT_TEXT_REQUIRED` if an image asset with null or blank `alt_text` is inserted here.

### 1.4 Pages

**`pages`** +LC

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| parent_id | uuid FK pages on delete restrict | max depth 3 (trigger) |
| title | text not null | 2–150 |
| slug | text not null | unique per `(coalesce(parent_id, '00000000-…'), slug)` among non-deleted rows (partial unique index) |
| path | text not null | materialised full path `/about/history`; maintained by trigger; unique among non-deleted |
| body | jsonb not null default `'{"type":"doc","content":[]}'` | Tiptap JSON |
| excerpt | text | max 300 |
| layout | page_layout not null default 'default' | |
| show_in_nav | boolean default false | |
| nav_order | int default 0 | |
| system_key | text unique | `'privacy'`, `'terms'`, `'about'`, `'exam-info'`; system pages can't be deleted or moved |
| seo | jsonb not null default '{}' | `{title?, description?, ogImageMediaId?, noindex?}` (Zod) |
| cover_media_id | uuid FK media_assets | |

**Search [PRD §4.2]:** `pages`, `events` and `resources` get the same generated `search tsvector` column and GIN index as `news_articles` (built from title + summary/excerpt + `body_text`). `public.site_search(q text, lim int)` is a security-invoker SQL function, so RLS applies. It UNIONs the four tables, ranks with `ts_rank_cd`, and returns `{type, title, href_slug, excerpt, published_at}`.

Reserved first segments: `search`, `admin`, `api`, `preview`, `login`, `news`, `events`, `gallery`, `staff`, `resources`, `contact`, `admissions`, `academics`, `about`*, `legal`*, `_next`. The check function `private.assert_page_path_ok`. (*`about` and `legal` are allowed only as page-tree roots; see §5.)

### 1.5 News

**`news_categories`** — id, name (unique ci), slug unique, description, sort_order, deleted_at.

**`news_articles`** +LC

| Column | Type | Notes |
|---|---|---|
| title | text not null | 5–160 |
| slug | text not null | unique among non-deleted (partial unique) |
| category_id | uuid FK news_categories on delete restrict | |
| excerpt | text | ≤ 300; app fills it from the body when empty |
| body | jsonb not null | |
| body_text | text not null default '' | plain text extracted by the app; feeds FTS |
| cover_media_id | uuid FK media_assets | |
| featured | boolean not null default false | |
| reading_minutes | smallint | computed in the app (200 wpm) |
| seo | jsonb default '{}' | |
| search | tsvector | `generated always as (setweight(to_tsvector('english', coalesce(title,'')),'A') || setweight(to_tsvector('english', coalesce(excerpt,'')),'B') || setweight(to_tsvector('english', body_text),'C')) stored` |

Indexes: GIN `(search)`, `(category_id)`, `(featured) where featured and status='published' and deleted_at is null`.
Trigger `private.enforce_max_featured`: rejects a published+featured row when the count would exceed `site_settings.data->'content'->>'maxFeaturedNews'`, with error `FEATURED_LIMIT`.

### 1.6 Academics

- **`academic_levels`** +LC — name, slug unique, description jsonb, curricula `curriculum[] not null default '{UNEB}'`, sort_order, cover_media_id.
- **`academic_programmes`** +LC — level_id FK academic_levels restrict, name, slug unique, summary ≤ 300, body jsonb, curriculum curriculum, duration_label text (e.g. "4 years"), entry_requirements jsonb, cover_media_id, sort_order.
- **`departments`** +LC — name unique ci, slug unique, description jsonb, head_staff_id FK staff_profiles set null, sort_order.
- **`subjects`** +LC — name, slug unique, department_id FK departments set null, description jsonb, sort_order.
- **`programme_subjects`** — programme_id FK cascade, subject_id FK cascade, `is_compulsory boolean default true`, sort_order, PK `(programme_id, subject_id)`. Index `(subject_id)`.
- **`co_curricular_activities`** +LC — name, slug unique, category text (`'sport'|'club'|'arts'|'faith'|'other'`, check), summary, body, cover_media_id, sort_order.
- Examination information = CMS pages under the `system_key='exam-info'` root. No separate table.

### 1.7 Events

- **`event_categories`** — name, slug unique, colour text (hex check; used only as an accent with a contrast-checked text pairing), sort_order, deleted_at.
- **`events`** +LC

| Column | Type | Notes |
|---|---|---|
| title | text not null | |
| slug | text not null | unique (partial) |
| category_id | uuid FK event_categories set null | |
| summary | text ≤ 300 | |
| body | jsonb | |
| all_day | boolean not null default false | |
| starts_at, ends_at | timestamptz | timed events |
| start_date, end_date | date | all-day events |
| venue | text ≤ 200 | |
| map_url | text | `check (map_url ~ '^https://(www\.)?(google\.[a-z.]+/maps|maps\.app\.goo\.gl|goo\.gl/maps)')` |
| cover_media_id | uuid FK | |
| featured | boolean default false | |
| seo | jsonb | |
| sort_key | timestamptz | `generated always as (coalesce(starts_at, start_date::timestamptz)) stored` |

Constraints: `check ((all_day and start_date is not null and starts_at is null and ends_at is null) or (not all_day and starts_at is not null and start_date is null and end_date is null))`, `check (ends_at is null or ends_at >= starts_at)`, `check (end_date is null or end_date >= start_date)`.
Index `(sort_key)`.
(`sort_key` casts a date to timestamptz, which depends on the session timezone. Generated columns need immutable expressions, so in practice it is computed by trigger with `at time zone 'UTC'`. Noted for implementation.)

### 1.8 Gallery

- **`gallery_categories`** — name, slug, sort_order, deleted_at.
- **`gallery_albums`** +LC — title, slug unique, category_id FK set null, description ≤ 1000, cover_media_id FK, album_date date, sort_order.
- **`gallery_items`** — id, album_id FK cascade, kind gallery_item_kind, media_id FK media_assets restrict, video_provider, video_id text (`^[A-Za-z0-9_-]{6,20}$`), video_thumbnail_url text (allow-listed hosts), caption ≤ 300, `featured boolean not null default false`, sort_order, created_by, created_at, updated_at. Check `((kind='image' and media_id is not null and video_id is null) or (kind='video' and video_id is not null and video_provider is not null and media_id is null))`. Index `(album_id, sort_order)`. Visibility follows the album, so the RLS policy joins to the parent album.

### 1.9 Staff, resources, enquiries

- **`staff_profiles`** +LC — `honorific` text, full_name, slug unique, position text, title text, bio jsonb, qualifications text[] (≤ 20), photo_media_id FK, is_leadership boolean, leadership_order int, display_order int, archived boolean default false, **`public_email` citext**, **`public_phone` text**. The two `public_*` columns are maintained by trigger from `staff_contacts`, and are null unless the matching `show_*` flag is on. **[DEV]** from MP §5.6: RLS is row-level, so per-field visibility is materialised into separate columns. The private values never sit in a publicly selectable table.
- **`staff_contacts`** — `staff_id uuid PK FK staff_profiles cascade`, email citext, phone_e164 text (`^\+[1-9]\d{7,14}$`), `show_email boolean not null default false`, `show_phone boolean not null default false`. Readable only with `staff.view`.
- **`staff_departments`** — staff_id, department_id, PK both, index `(department_id)`.
- **`resource_categories`** — name, slug, sort_order, deleted_at.
- **`resources`** +LC — title, slug unique, description ≤ 1000, category_id FK, current_file_id FK resource_files (deferrable), `download_count bigint not null default 0`.
- **`resource_files`** — id, resource_id FK cascade, version int, path text unique (bucket `resources`), mime_type (allow-list), size_bytes, original_filename, uploaded_by, created_at, unique `(resource_id, version)`.
- **`contact_messages`** — id, name (2–100), email citext, phone_e164 (nullable), subject text (must be one of the configured subjects; checked in the RPC), message text (`check (char_length(message) between 20 and 2000)`), status enquiry_status default 'new', assigned_to FK profiles set null, read_at, replied_at, ip_hash text, consent_text_version text not null, consented_at timestamptz not null, deleted_at, created_at, updated_at, version. Indexes: `(status, created_at desc)`, `(assigned_to)`, `(created_at)` for retention.
- **`enquiry_notes`** — id, message_id FK cascade, author_id FK profiles, body ≤ 2000, created_at. Index `(message_id)`.

### 1.10 Admissions

**`admission_forms`** — id, name, `is_default boolean`, created_by, timestamps. (MP calls this `admissions_forms`; the spec uses the singular form consistently: `admission_*`.)

**`admission_form_versions`** — id, form_id FK cascade, version int, `definition jsonb not null` (validated by the `FormDefinition` Zod schema, §4.11), `published_at`, `published_by`, unique `(form_id, version)`. **Immutable once published** (trigger). Applications pin a version, so editing the form never corrupts old applications.

**`admission_intakes`** +LC — name ("Senior One 2027 — Term 1"), slug unique, academic_year smallint, term text, opens_at timestamptz not null, closes_at timestamptz not null (`check (closes_at > opens_at)`), form_version_id FK admission_form_versions restrict, required_documents jsonb (`[{key, label, help, required, accept: ('pdf'|'image')[]}]`), capacity int null (informational), `resource_ids uuid[] not null default '{}'` (downloadable forms, PRD §5.1), description jsonb.

**`admission_intake_classes`** — id, intake_id FK cascade, label ("Senior One", "P.1"), level_id FK academic_levels set null, sort_order. Index `(intake_id)`.

**`admission_statuses`** — id, key text unique, name text, colour text (hex), sort_order, is_initial boolean (exactly one: partial unique index `where is_initial`), is_terminal boolean, outcome text `check (outcome in ('pending','accepted','rejected','withdrawn'))` (drives the acceptance rate and retention), notify_applicant boolean, email_template_key text, `public_label` text (what the guardian sees), deleted_at.
Seeded with the seven PRD §5.1 statuses:

| key | name | initial | terminal | outcome | notify |
|---|---|---|---|---|---|
| `submitted` | Submitted | ✓ | | pending | ✓ (acknowledgement) |
| `under_review` | Under Review | | | pending | ✓ |
| `info_required` | Additional Information Required | | | pending | ✓ (info-request link) |
| `shortlisted` | Shortlisted | | | pending | ✓ |
| `accepted` | Accepted | | ✓ | accepted | ✓ |
| `rejected` | Rejected (guardian-facing label: "Not successful") | | ✓ | rejected | ✓ |
| `withdrawn` | Withdrawn | | ✓ | withdrawn | ✗ |

**`applications`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | pre-allocated by `start_application` (D6) |
| reference | text unique not null | `NAM-2027-7K3QX9`, set **only** by `submit_application` |
| intake_id | uuid FK admission_intakes restrict | |
| intake_class_id | uuid FK admission_intake_classes restrict | |
| form_version_id | uuid FK admission_form_versions restrict | |
| status_id | uuid FK admission_statuses restrict | |
| applicant_first_name, applicant_last_name | text not null | ≤ 80 |
| applicant_other_names | text | |
| applicant_dob | date not null | `check (applicant_dob > '1950-01-01')` |
| applicant_gender | text | nullable; optional unless the form requires it |
| guardian_name | text not null | |
| guardian_relationship | text not null | |
| guardian_email | citext not null | |
| guardian_phone_e164 | text not null | |
| answers | jsonb not null default '{}' | the configured non-medical extra fields, keyed by field id |
| consent_text_version | text not null | |
| consented_at | timestamptz not null | |
| consent_ip_hash | text not null | |
| submitted_at | timestamptz not null | |
| status_changed_at | timestamptz not null | for "pending age" |
| assigned_to | uuid FK profiles set null | |
| anonymised_at | timestamptz | DSR erase / retention |
| deleted_at | timestamptz | |
| version | int | |

Indexes: `(intake_id, status_id)`, `(status_id, status_changed_at)`, `(submitted_at)`, `(assigned_to)`, `lower(guardian_email)`, `(guardian_phone_e164)`, trigram on `applicant_last_name || ' ' || applicant_first_name` for admin search.

**`application_medical`** — `application_id uuid PK FK applications cascade`, `answers jsonb not null`, created_at. **Separate table** so `admissions.view_medical` can be enforced by RLS (DPPA s.9).

**`application_upload_sessions`** (D6) — `application_id uuid PK` (pre-allocated), `intake_id FK`, `token_hash bytea not null` (sha256 of the opaque token held in the browser's localStorage), `expires_at timestamptz` (24 h), `ip_hash`, `submitted_at`, created_at. Purged by cron after expiry together with orphaned objects.

**`application_documents`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| application_id | uuid not null | FK applications **deferred**: a document can exist under a session before submit. Enforced by trigger: it must match an upload session or an application. |
| requirement_key | text not null | matches `intake.required_documents[].key`, or `'other'` |
| info_request_id | uuid FK admission_info_requests | when uploaded through an info-request link |
| path | text unique not null | `{application_id}/{uuid}.{ext}` |
| mime_type | text | set after the magic-byte check |
| size_bytes | bigint | |
| sha256 | text | |
| state | upload_state not null default 'pending' | |
| expires_at | timestamptz | for pending slots |
| review | document_review default 'unreviewed' | |
| reviewed_by / reviewed_at | | |
| created_at | | |

Indexes: `(application_id)`, `(state, expires_at)`.

**`admission_status_history`** — id, application_id FK cascade, from_status_id, to_status_id, changed_by FK profiles, changed_at, public_message text ≤ 1000. Append-only (no UPDATE/DELETE policy plus a trigger). Index `(application_id, changed_at)`.

**`admission_notes`** — id, application_id FK cascade, status_history_id FK set null, author_id, body ≤ 4000, created_at. Append-only. Index `(application_id)`.

**`admission_info_requests`** — id, application_id FK cascade, token_hash bytea unique, requested_items jsonb (`[{key,label}]`), message ≤ 1000, expires_at, used_at, created_by, created_at.

**`private.application_ref_seq`** and **`private.app_secrets`** (`name text PK`, read from Vault): `ref_feistel_key`, `form_signing_secret`, `ip_hash_salt`.

**Reference generator** (MP §5.1) `private.next_application_reference(p_submitted_at timestamptz) returns text`:
1. `n := nextval('private.application_ref_seq')`. It must be `< 2^25`; if not, raise `REF_SPACE_EXHAUSTED` (33.5 million references per school).
2. `p := private.feistel25(n, ref_feistel_key)`: a 4-round balanced Feistel network on 25 bits, splitting into 13 + 12 bits (unbalanced). It is a bijection, so p is unique, and it is non-sequential, so it is not guessable.
3. `body := crockford_base32(p, 5 chars)`; `check := luhn_mod_n(body, 32)`. Luhn mod N catches every single-character error and most adjacent swaps, which matters for references read out over the phone.
4. Result: `prefix || '-' || to_char(p_submitted_at at time zone tz, 'YYYY') || '-' || body || check`.

Input normalisation for tracking: uppercase; `O`→`0`; `I`/`L`→`1`; strip spaces and dashes; then validate the checksum before any DB lookup.

### 1.11 Email, audit, ops

**`email_messages`** — id, template_key text, to_email citext (purged by retention), entity_type, entity_id, payload jsonb (template props, no free-text PII beyond the needed fields), status email_status, resend_id text unique, attempts smallint default 0, next_attempt_at timestamptz, last_error text (sanitised), sent_at, delivered_at, created_at. Indexes: `(status, next_attempt_at)`, `(entity_type, entity_id)`.

**`email_suppressions`** — `email_hash text PK` (sha256 of the lowercased email), reason (`bounce|complaint|manual`), created_at. Checked before every send.

**`activity_logs`**

| Column | Type | Notes |
|---|---|---|
| id | bigint generated always as identity PK | |
| occurred_at | timestamptz not null default now() | |
| source | log_source not null | |
| actor_id | uuid | no FK, so logs outlive users. Index. |
| actor_label | text | name snapshot at the time |
| action | text not null | `news.publish`, `admissions.status_change`, `auth.login`, `auth.login_failed_burst`, `admissions.document_download`, `support.access`, … |
| entity_type | text | |
| entity_id | text | |
| summary | text | human-readable line for the UI |
| diff | jsonb | `{before, after}`, with redacted keys replaced by `"[redacted]"` |
| metadata | jsonb | e.g. `{rowCount, filter}` for exports |
| ip_hash | text | |

Indexes: `(occurred_at desc)`, `(actor_id, occurred_at desc)`, `(entity_type, entity_id)`, `(action)`.

**`auth_admin_jobs`** (D13) — id, `op text check (op in ('invite','resend_invite','sign_out'))`, `target_user_id uuid`, `payload jsonb` (invite: email, full_name, role_ids), `requested_by uuid FK profiles`, `state text check (state in ('pending','done','failed'))`, `error text`, created_at, completed_at. RLS: insert with check `has_permission('users.manage') and requested_by = (select auth.uid())`; select `users.view`; no update/delete policy (the internal route updates it via `admin.ts`). An insert trigger runs the escalation check against `payload.role_ids`.

**`private.rate_limit_buckets`** — key text, window_start timestamptz, count int, PK `(key, window_start)`. Unlogged table, purged hourly.

**`private.submission_tickets_used`** — `ticket_hash bytea PK`, used_at. Replay protection, purged after 10 min.

**`retention_runs`** — id, job text, started_at, finished_at, summary jsonb (counts only).

### 1.12 Entity-relationship summary (abridged)

```
auth.users 1─1 profiles 1─* user_roles *─1 roles 1─* role_permissions *─1 permissions
profiles 1─* support_access_grants
pages (self-tree)            news_categories 1─* news_articles
academic_levels 1─* academic_programmes *─* subjects (programme_subjects) *─1 departments
event_categories 1─* events  gallery_albums 1─* gallery_items *─1 media_assets
staff_profiles 1─1 staff_contacts; staff_profiles *─* departments (staff_departments)
resources 1─* resource_files ; resources.current_file_id → resource_files
contact_messages 1─* enquiry_notes
admission_forms 1─* admission_form_versions 1─* admission_intakes 1─* admission_intake_classes
applications ─ intake/class/form_version/status ; 1─1 application_medical ; 1─* application_documents,
  admission_status_history, admission_notes, admission_info_requests
media_assets 1─* media_usages (polymorphic owner)
```

### 1.13 Triggers & DB functions inventory

| Function (all `security definer set search_path = ''` unless noted) | Purpose |
|---|---|
| `private.touch_updated_at()` (invoker) | `updated_at = now()` |
| `private.content_lifecycle_guard()` | TG_ARGV[0] = module. Sets created_by/updated_by, bumps version, enforces the status-transition permissions (§2.3), sets `published_at`, writes `redirects` on slug change, blocks un-deleting without `.delete` |
| `private.enforce_max_featured()` | news featured cap |
| `private.page_path_maintain()` | materialised path, depth ≤ 3, reserved segments, cascade path to children + redirects |
| `private.media_usage_requires_alt()` | alt text before use |
| `private.staff_public_contact_sync()` | staff_contacts → staff_profiles.public_* |
| `private.guard_role_grant()` | on user_roles insert/delete: the grantor must hold every permission of the role (`ESCALATION_DENIED`); writes a `db`-source audit row |
| `private.guard_role_permission_change()` | on role_permissions insert/delete: the actor must hold the permission being added; system roles are immutable except by the seed |
| `private.guard_last_super_admin()` | on user_roles delete and profiles.status update: at least 1 active super_admin must remain (`LAST_SUPER_ADMIN`) |
| `private.forbid_update_delete()` | append-only tables (activity_logs, admission_status_history, admission_notes). Bypass only when `current_setting('app.retention_purge', true) = 'on'` **and** `current_user = 'postgres'` (the retention cron runs a definer function owned by postgres) |
| `private.audit_sensitive_change()` | db-source logs for user_roles, role_permissions, profiles.status, site_settings, support_access_grants, applications.status_id |
| `private.on_auth_user_created()` | creates a profile from invite metadata (`full_name`, `role_ids`); rejects if not invited |
| `private.sync_mfa_enrolled()` | on auth.mfa_factors insert/delete |
| `public.has_permission(p text)` | §2.4 |
| `private.mfa_satisfied()` | true unless `features.mfaRequiredForAdmins` and `auth.jwt()->>'aal' <> 'aal2'` |
| `private.verify_ticket(purpose, payload_sha256, issued_at, mac)` | D5 |
| `private.rate_limit_hit(key, max, window_seconds)` | D9 |
| `private.next_application_reference(ts)` | §1.10 |
| `private.feistel25`, `private.crockford32`, `private.luhn_mod32` (immutable, invoker) | helpers |
| RPCs in `public` | `submit_enquiry`, `start_application`, `request_admission_upload`, `confirm_admission_upload`, `submit_application`, `track_application`, `request_info_upload`, `confirm_info_upload`, `increment_resource_download`, `log_activity`, `rate_limit_check_auth`, `change_application_status`, `get_dashboard_counts`, `admissions_report` (§4) |


---

## 2. Permission model & matrix

### 2.1 Roles (seed, PRD §7)

| Key | Display name (UI) | PRD responsibility | Notes |
|---|---|---|---|
| `super_admin` | Super Administrator | Full school installation administration | the only holder of `users.manage_roles`, `trash.purge`, `admissions.delete`, `view_medical` by default |
| `school_admin` | School Administrator | General website and content management | can invite and manage users within their own permissions (PRD §3.2) |
| `headteacher` | Headteacher / Director | Oversight and approved management functions | holds `approve` on every content module, reads admissions (+notes) and reports, manages administrators (PRD §3.3) |
| `admissions_officer` | Admissions Officer | Admissions and application management | |
| `content_editor` | Content Editor | News, pages, resources and media | also the gallery, which is photo/video media (PRD §3.2) |
| `events_manager` | Events Manager | Events calendar | |
| `read_only_staff` | Read-only Staff | View permitted administrative information | content and appearance read-only; no personal data |
| `platform_support` | Altrastate Support | PRD §3.4 technical administrators | system role; personal data only through a time-boxed grant |

All seven PRD roles are `is_system = true`, so their names and permission sets can't be changed from the UI. Schools that need something different create **custom roles** ("Roles must be configurable to the extent necessary", PRD §7).

### 2.2 Permission keys (seed: 69 keys)

- **Content modules** (`pages`, `news`, `academics`, `events`, `gallery`, `staff`, `resources`) × `view`, `create`, `edit`, `publish`, `approve`, `delete` = 42
- `media.view` · `media.create` · `media.edit` · `media.delete`
- `enquiries.view` · `enquiries.edit` · `enquiries.delete` · `enquiries.export`
- `admissions.view` · `admissions.create` **[EXT]** (manual entry of paper applications; Q9) · `admissions.edit` · `admissions.manage` (forms, intakes, statuses) · `admissions.export` · `admissions.delete` (erase/anonymise) · `admissions.view_notes` · `admissions.view_medical`
- `appearance.view` · `appearance.manage`
- `settings.view` · `settings.manage`
- `users.view` · `users.manage` · `users.manage_roles`
- `activity.view` · `activity.export`
- `trash.purge` **[EXT]**: MP §4.2's "explicit Super Admin purge" needs a key

Sensitive (`is_sensitive = true`): every `admissions.*` key except `admissions.manage`, plus `enquiries.view`, `enquiries.edit`, `enquiries.export`, `enquiries.delete`, `activity.export` and `users.view`.

### 2.3 Lifecycle transition rules (enforced by `content_lifecycle_guard`, where M is the module)

| From → To | Approval off | Approval on (`features.contentApproval`) |
|---|---|---|
| (new) → draft | `M.create` | `M.create` |
| draft ↔ draft (edit) | `M.edit` (own **or** any; v1 has no ownership restriction, Q10) | same |
| draft → in_review | not allowed (UI hides it) | `M.edit` |
| in_review → draft ("Send back") | n/a | `M.approve` |
| draft/in_review → scheduled/published | `M.publish` | `M.approve` **[DEV]**: MP says "users holding approve publish"; the spec reads it as approve being the gate when approval is on (Q4) |
| published → draft ("Hide from website") | `M.publish` | `M.approve` |
| any → archived | `M.publish` | `M.approve` |
| edit of published row content | `M.publish` (applying a working copy to a live row is a publish) | `M.approve` |
| set `deleted_at` (Trash) / clear it (Restore) | `M.delete` | `M.delete` |
| hard DELETE | `trash.purge` and `deleted_at is not null` | same |

Error code raised: `TRANSITION_DENIED` (SQLSTATE `42501`), which the app maps to a plain-language message.

### 2.4 `has_permission`

```sql
create or replace function public.has_permission(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.uid()) is not null, false)
     and exists (
       select 1 from public.profiles pr
       where pr.id = (select auth.uid()) and pr.status = 'active'
     )
     and (
       exists (                                   -- ordinary role grant
         select 1
         from public.user_roles ur
         join public.role_permissions rp on rp.role_id = ur.role_id
         join public.roles r on r.id = ur.role_id
         join public.permissions pm on pm.key = rp.permission_key
         where ur.user_id = (select auth.uid())
           and rp.permission_key = p
           and not (r.key = 'platform_support' and pm.is_sensitive)   -- belt & braces
       )
       or exists (                                -- time-boxed support grant
         select 1 from public.support_access_grants g
         where g.grantee_id = (select auth.uid())
           and p = any (g.permission_keys)
           and g.revoked_at is null
           and now() between g.starts_at and g.expires_at
       )
     );
$$;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to anon, authenticated;
```

The app's `requirePermission(p)`:
1. Calls `getClaims()`. No claims → `UnauthenticatedError`.
2. Calls `rpc('has_permission', {p})`. false → `ForbiddenError`.
3. If the user holds `platform_support` and `p` is sensitive, writes a `support.access` audit row (MP §6).
4. Returns `{ userId, aal }`.

It is memoised per request with React `cache()`.

### 2.5 Matrix

Legend: ● granted · ○ not granted · ◐ only through a time-boxed support grant. ADM = school_admin, HT = headteacher, AO = admissions_officer, CE = content_editor, EM = events_manager, RO = read_only_staff, PS = platform_support.

Content modules fall into three groups:
- **A** = `pages`, `news`, `resources`, `gallery` (the Content Editor's scope)
- **B** = `academics`, `staff`
- **C** = `events` (the Events Manager's scope)

| Permission | super_admin | ADM | HT | AO | CE | EM | RO | PS |
|---|---|---|---|---|---|---|---|---|
| `{A,B,C}.view` | ● | ● | ● | ○ | ● | ● | ● | ● |
| `{A}.create` / `.edit` / `.publish` / `.delete` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `{B}.create` / `.edit` / `.publish` / `.delete` | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| `{C}.create` / `.edit` / `.publish` / `.delete` | ● | ● | ○ | ○ | ○ | ● | ○ | ○ |
| `{A,B,C}.approve` and `{A,B,C}.publish` | ● | ● | ● | ○ | (publish: A only) | (publish: C only) | ○ | ○ |
| `media.view` | ● | ● | ● | ● | ● | ● | ● | ● |
| `media.create` / `media.edit` | ● | ● | ○ | ○ | ● | ● | ○ | ○ |
| `media.delete` | ● | ● | ○ | ○ | ● | ○ | ○ | ○ |
| `enquiries.view` / `enquiries.edit` | ● | ● | ● (view only) | ● | ○ | ○ | ○ | ◐ |
| `enquiries.delete` / `enquiries.export` | ● | ● | ○ | ○ | ○ | ○ | ○ | ◐ |
| `admissions.view` | ● | ● | ● | ● | ○ | ○ | ○ | ◐ |
| `admissions.create` / `admissions.edit` | ● | ● | ○ | ● | ○ | ○ | ○ | ◐ |
| `admissions.manage` | ● | ● | ○ | ● | ○ | ○ | ○ | ○ |
| `admissions.export` | ● | ● | ○ | ● | ○ | ○ | ○ | ◐ |
| `admissions.view_notes` | ● | ● | ● | ● | ○ | ○ | ○ | ◐ |
| `admissions.view_medical` | ● | ○ | ○ | ○ | ○ | ○ | ○ | ◐ |
| `admissions.delete` | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `appearance.view` | ● | ● | ● | ○ | ● | ○ | ● | ● |
| `appearance.manage` | ● | ● | ○ | ○ | ○ | ○ | ○ | ● |
| `settings.view` / `settings.manage` | ● | ● | ○ | ○ | ○ | ○ | ○ | ● |
| `users.view` / `users.manage` | ● | ● | ● | ○ | ○ | ○ | ○ | ◐ (view) / ○ |
| `users.manage_roles` | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `activity.view` | ● | ● | ● | ○ | ○ | ○ | ○ | ● |
| `activity.export` | ● | ○ | ○ | ○ | ○ | ○ | ○ | ◐ |
| `trash.purge` | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ |

How the PRD §6.6 workflow plays out:
- **Approval off:** the CE or EM publishes directly in their own scope.
- **Approval on:** the CE or EM can only "Submit for review", and HT (or ADM/SA) approves and publishes.

Notes:
- The defaults are deliberately conservative on medical data: only super_admin, and only with AAL2 when MFA is required. Schools grant `view_medical` through a custom role, after the DPPA s.9 review (Q3).
- `school_admin` and `headteacher` can invite users and assign roles, but only roles whose permissions they hold (escalation trigger). In practice, ADM can assign AO, CE, EM, RO and HT, because HT holds nothing that ADM lacks. HT can assign only RO, plus any custom role that is a subset of HT's permissions.
- PS's ● on `activity.view` shows **audit metadata** only; `diff` values for sensitive entities are redacted at write time.

---

## 3. RLS policies (SQL)

### 3.0 Global rules (first migration)

```sql
-- No direct writes for anon anywhere, ever (defence in depth on top of RLS)
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;
revoke insert, update, delete, truncate on all tables in schema public from anon;
-- private schema: functions reachable from policies, never through the API
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;   -- needed for policy function calls; not in PostgREST exposed schemas
-- every private function: revoke execute from public; grant to the minimal roles explicitly
```

Every `create table` in `public` is immediately followed by `alter table … enable row level security;`. The pgTAP test `00_rls_enabled.sql` asserts this for **all** tables in `public` and in the custom schemas.

### 3.1 LC template (applied to every +LC content table)

Shown for `news_articles` (module `news`). The migration applies the identical policy text to each table/module pair below, through `private.apply_lc_policies(regclass, text)`. That is a migration-time helper that runs `format()`-ed `create policy` statements and is dropped after use. The pgTAP test `03_policy_text.sql` asserts each resulting `pg_policies.qual` / `with_check` exactly.

| Table | Module |
|---|---|
| pages | pages |
| news_articles | news |
| academic_levels, academic_programmes, departments, subjects, co_curricular_activities | academics |
| events | events |
| gallery_albums | gallery |
| staff_profiles | staff |
| resources | resources |

```sql
alter table public.news_articles enable row level security;

-- SELECT: public sees live rows; staff with view see everything (incl. drafts & trash)
create policy news_articles_select on public.news_articles
  for select to anon, authenticated
  using (
    (status = 'published' and publish_at <= now() and deleted_at is null)
    or (select public.has_permission('news.view'))
  );

create policy news_articles_insert on public.news_articles
  for insert to authenticated
  with check ( (select public.has_permission('news.create')) );

-- UPDATE: any of the mutating perms admits the row; the lifecycle trigger decides
-- which specific transition is allowed (§2.3)
create policy news_articles_update on public.news_articles
  for update to authenticated
  using (
    (select public.has_permission('news.edit'))
    or (select public.has_permission('news.publish'))
    or (select public.has_permission('news.approve'))
    or (select public.has_permission('news.delete'))
  )
  with check (
    (select public.has_permission('news.edit'))
    or (select public.has_permission('news.publish'))
    or (select public.has_permission('news.approve'))
    or (select public.has_permission('news.delete'))
  );

-- DELETE: only purge of trashed rows
create policy news_articles_delete on public.news_articles
  for delete to authenticated
  using ( deleted_at is not null and (select public.has_permission('trash.purge')) );

create trigger news_articles_lifecycle before insert or update on public.news_articles
  for each row execute function private.content_lifecycle_guard('news');
```

`has_permission(<constant>)` is wrapped in `(select …)`, so Postgres evaluates it once per statement as an initPlan, not once per row.

### 3.2 Taxonomy tables (categories)

Applies to `news_categories` (news), `event_categories` (events), `gallery_categories` (gallery) and `resource_categories` (resources). Shown for news:

```sql
create policy news_categories_select on public.news_categories for select to anon, authenticated
  using ( deleted_at is null or (select public.has_permission('news.view')) );
create policy news_categories_insert on public.news_categories for insert to authenticated
  with check ( (select public.has_permission('news.publish')) );
create policy news_categories_update on public.news_categories for update to authenticated
  using ( (select public.has_permission('news.publish')) )
  with check ( (select public.has_permission('news.publish')) );
create policy news_categories_delete on public.news_categories for delete to authenticated
  using ( (select public.has_permission('trash.purge')) );   -- FK restrict prevents deleting used categories
```

### 3.3 Child / join tables (visibility follows the parent)

```sql
-- programme_subjects (academics)
create policy programme_subjects_select on public.programme_subjects for select to anon, authenticated
  using (
    (select public.has_permission('academics.view'))
    or exists (select 1 from public.academic_programmes p
               where p.id = programme_id and p.status = 'published'
                 and p.publish_at <= now() and p.deleted_at is null)
  );
create policy programme_subjects_write on public.programme_subjects for all to authenticated
  using ( (select public.has_permission('academics.edit')) )
  with check ( (select public.has_permission('academics.edit')) );

-- gallery_items (gallery)
create policy gallery_items_select on public.gallery_items for select to anon, authenticated
  using (
    (select public.has_permission('gallery.view'))
    or exists (select 1 from public.gallery_albums a
               where a.id = album_id and a.status = 'published'
                 and a.publish_at <= now() and a.deleted_at is null)
  );
create policy gallery_items_write on public.gallery_items for all to authenticated
  using ( (select public.has_permission('gallery.edit')) )
  with check ( (select public.has_permission('gallery.edit')) );

-- staff_departments (staff): same shape against staff_profiles / staff.view / staff.edit
-- resource_files (resources): same shape against resources / resources.view / resources.edit
--   (old versions are selectable publicly only when they are the current file:)
create policy resource_files_select on public.resource_files for select to anon, authenticated
  using (
    (select public.has_permission('resources.view'))
    or exists (select 1 from public.resources r
               where r.current_file_id = resource_files.id and r.status = 'published'
                 and r.publish_at <= now() and r.deleted_at is null)
  );
-- admission_intake_classes: public read if parent intake published; write admissions.manage (§3.7)

-- staff_contacts: never public
create policy staff_contacts_select on public.staff_contacts for select to authenticated
  using ( (select public.has_permission('staff.view')) );
create policy staff_contacts_write on public.staff_contacts for all to authenticated
  using ( (select public.has_permission('staff.edit')) )
  with check ( (select public.has_permission('staff.edit')) );
```

Indexes supporting these subqueries: `gallery_items(album_id)`, `programme_subjects(programme_id)`, `resources(current_file_id)`, `staff_departments(staff_id)`.

### 3.4 Settings, redirects, drafts, media

```sql
-- site_settings: public branding is readable by everyone; writes only through RPC update_site_settings
create policy site_settings_select on public.site_settings for select to anon, authenticated using (true);
-- (no insert/update/delete policies; RPC is security definer and checks per-section permission)

-- site_settings_private [EXT]: internal inbox addresses, retention numbers. Not public.
create policy site_settings_private_select on public.site_settings_private for select to authenticated
  using ( (select public.has_permission('settings.view')) );

create policy redirects_select on public.redirects for select to anon, authenticated using (true);
create policy redirects_write on public.redirects for all to authenticated
  using ( (select public.has_permission('settings.manage')) )
  with check ( (select public.has_permission('settings.manage')) );

-- content_drafts: entity_type is constrained to module keys
alter table public.content_drafts add constraint content_drafts_entity_type_chk
  check (entity_type in ('pages','news','academics','events','gallery','staff','resources'));
create policy content_drafts_all on public.content_drafts for all to authenticated
  using ( public.has_permission(entity_type || '.edit') )          -- row-dependent; table is tiny
  with check ( public.has_permission(entity_type || '.edit') and updated_by = (select auth.uid()) );

-- media_assets: anon may read only presentation columns of non-deleted assets
revoke select on public.media_assets from anon;
grant select (id, kind, bucket, path, mime_type, width, height, alt_text, caption, lqip, blurhash)
  on public.media_assets to anon;
create policy media_assets_select on public.media_assets for select to anon, authenticated
  using ( deleted_at is null or (select public.has_permission('media.view')) );
create policy media_assets_insert on public.media_assets for insert to authenticated
  with check ( (select public.has_permission('media.create')) and uploaded_by = (select auth.uid()) );
create policy media_assets_update on public.media_assets for update to authenticated
  using ( (select public.has_permission('media.edit')) or (select public.has_permission('media.delete')) )
  with check ( (select public.has_permission('media.edit')) or (select public.has_permission('media.delete')) );
  -- trigger: setting deleted_at requires media.delete AND no media_usages rows (MEDIA_IN_USE)
create policy media_assets_delete on public.media_assets for delete to authenticated
  using ( deleted_at is not null and (select public.has_permission('trash.purge')) );

create policy media_usages_select on public.media_usages for select to authenticated
  using ( (select public.has_permission('media.view')) );
create policy media_usages_write on public.media_usages for all to authenticated
  using ( public.has_permission(private.module_of(entity_type) || '.edit') )
  with check ( public.has_permission(private.module_of(entity_type) || '.edit') );
-- module_of(): immutable map 'news_articles'→'news', 'site_settings'→'appearance', etc.
```

### 3.5 Identity & RBAC tables

```sql
create policy profiles_select on public.profiles for select to authenticated
  using ( id = (select auth.uid()) or (select public.has_permission('users.view')) );
create policy profiles_update_self on public.profiles for update to authenticated
  using ( id = (select auth.uid()) ) with check ( id = (select auth.uid()) );
create policy profiles_update_admin on public.profiles for update to authenticated
  using ( (select public.has_permission('users.manage')) )
  with check ( (select public.has_permission('users.manage')) );
-- trigger private.profile_update_guard: a self-update may change only full_name; status changes
-- need users.manage and pass guard_last_super_admin; nobody may change id/email directly.

create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated
  using ( (select public.has_permission('users.manage_roles')) and not is_system )
  with check ( (select public.has_permission('users.manage_roles')) and not is_system );

create policy permissions_select on public.permissions for select to authenticated using (true);
-- no write policy: permissions change only by migration

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_write on public.role_permissions for all to authenticated
  using ( (select public.has_permission('users.manage_roles'))
          and not exists (select 1 from public.roles r where r.id = role_id and r.is_system) )
  with check ( (select public.has_permission('users.manage_roles'))
          and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
          and public.has_permission(permission_key) );            -- can't grant what you don't hold

create policy user_roles_select on public.user_roles for select to authenticated
  using ( user_id = (select auth.uid()) or (select public.has_permission('users.view')) );
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check ( (select public.has_permission('users.manage'))
               and user_id <> (select auth.uid())                   -- no self-grant
               and granted_by = (select auth.uid()) );
create policy user_roles_delete on public.user_roles for delete to authenticated
  using ( (select public.has_permission('users.manage')) );
-- triggers: guard_role_grant (grantor ⊇ role perms), guard_last_super_admin, audit_sensitive_change.
-- No UPDATE policy: change = delete + insert.

create policy support_grants_select on public.support_access_grants for select to authenticated
  using ( grantee_id = (select auth.uid()) or (select public.has_permission('users.view')) );
create policy support_grants_insert on public.support_access_grants for insert to authenticated
  with check ( (select public.has_permission('users.manage_roles')) and granted_by = (select auth.uid()) );
create policy support_grants_revoke on public.support_access_grants for update to authenticated
  using ( (select public.has_permission('users.manage_roles')) )
  with check ( (select public.has_permission('users.manage_roles')) );
-- trigger: only revoked_at/revoked_by may change; grantee must hold platform_support;
-- permission_keys ⊆ sensitive keys; expiry ≤ 7 days.
```

### 3.6 Enquiries

```sql
create policy contact_messages_select on public.contact_messages for select to authenticated
  using ( (select public.has_permission('enquiries.view')) and (select private.mfa_satisfied()) );
create policy contact_messages_update on public.contact_messages for update to authenticated
  using ( ((select public.has_permission('enquiries.edit')) or (select public.has_permission('enquiries.delete')))
          and (select private.mfa_satisfied()) )
  with check ( ((select public.has_permission('enquiries.edit')) or (select public.has_permission('enquiries.delete')))
          and (select private.mfa_satisfied()) );
-- trigger: only status/assigned_to/read_at/replied_at/deleted_at/version may change;
-- deleted_at needs enquiries.delete. No INSERT (RPC submit_enquiry) and no DELETE (retention cron) policy.

create policy enquiry_notes_select on public.enquiry_notes for select to authenticated
  using ( (select public.has_permission('enquiries.view')) and (select private.mfa_satisfied()) );
create policy enquiry_notes_insert on public.enquiry_notes for insert to authenticated
  with check ( (select public.has_permission('enquiries.edit')) and author_id = (select auth.uid())
               and (select private.mfa_satisfied()) );
```

### 3.7 Admissions

```sql
-- forms & versions
create policy admission_forms_select on public.admission_forms for select to authenticated
  using ( (select public.has_permission('admissions.view')) );
create policy admission_forms_write on public.admission_forms for all to authenticated
  using ( (select public.has_permission('admissions.manage')) )
  with check ( (select public.has_permission('admissions.manage')) );

create policy form_versions_select on public.admission_form_versions for select to anon, authenticated
  using (
    (select public.has_permission('admissions.view'))
    or exists (select 1 from public.admission_intakes i
               where i.form_version_id = admission_form_versions.id
                 and i.status = 'published' and i.publish_at <= now() and i.deleted_at is null)
  );
create policy form_versions_insert on public.admission_form_versions for insert to authenticated
  with check ( (select public.has_permission('admissions.manage')) );
create policy form_versions_update on public.admission_form_versions for update to authenticated
  using ( (select public.has_permission('admissions.manage')) and published_at is null )
  with check ( (select public.has_permission('admissions.manage')) );

-- intakes (LC columns, but module permission = admissions.manage for every transition)
create policy intakes_select on public.admission_intakes for select to anon, authenticated
  using ( (status = 'published' and publish_at <= now() and deleted_at is null)
          or (select public.has_permission('admissions.view')) );
create policy intakes_write on public.admission_intakes for all to authenticated
  using ( (select public.has_permission('admissions.manage')) )
  with check ( (select public.has_permission('admissions.manage')) );
-- trigger content_lifecycle_guard('admissions') maps publish/approve/delete → admissions.manage

create policy intake_classes_select on public.admission_intake_classes for select to anon, authenticated
  using ( (select public.has_permission('admissions.view'))
          or exists (select 1 from public.admission_intakes i where i.id = intake_id
                     and i.status = 'published' and i.publish_at <= now() and i.deleted_at is null) );
create policy intake_classes_write on public.admission_intake_classes for all to authenticated
  using ( (select public.has_permission('admissions.manage')) )
  with check ( (select public.has_permission('admissions.manage')) );

create policy statuses_select on public.admission_statuses for select to authenticated
  using ( (select public.has_permission('admissions.view')) );
create policy statuses_write on public.admission_statuses for all to authenticated
  using ( (select public.has_permission('admissions.manage')) )
  with check ( (select public.has_permission('admissions.manage')) );

-- applications: no INSERT/DELETE policies (RPCs + retention cron only)
create policy applications_select on public.applications for select to authenticated
  using ( (select public.has_permission('admissions.view')) and (select private.mfa_satisfied()) );
create policy applications_update on public.applications for update to authenticated
  using ( (select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()) )
  with check ( (select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()) );
-- trigger private.application_update_guard: reference, consent_*, submitted_at, form_version_id,
-- intake_id immutable; status_id changes only inside change_application_status()
-- (checks current_setting('app.in_status_rpc', true) = 'on', set with set_config(..., true) in that RPC).

create policy application_medical_select on public.application_medical for select to authenticated
  using ( (select public.has_permission('admissions.view'))
          and (select public.has_permission('admissions.view_medical'))
          and (select private.mfa_satisfied()) );

create policy application_documents_select on public.application_documents for select to authenticated
  using ( (select public.has_permission('admissions.view')) and (select private.mfa_satisfied()) );
create policy application_documents_review on public.application_documents for update to authenticated
  using ( (select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()) )
  with check ( (select public.has_permission('admissions.edit')) and (select private.mfa_satisfied()) );
-- trigger: only review/reviewed_by/reviewed_at may change via this path

create policy status_history_select on public.admission_status_history for select to authenticated
  using ( (select public.has_permission('admissions.view')) and (select private.mfa_satisfied()) );

create policy admission_notes_select on public.admission_notes for select to authenticated
  using ( (select public.has_permission('admissions.view_notes')) and (select private.mfa_satisfied()) );
create policy admission_notes_insert on public.admission_notes for insert to authenticated
  with check ( (select public.has_permission('admissions.view_notes'))
               and author_id = (select auth.uid()) and (select private.mfa_satisfied()) );

create policy info_requests_select on public.admission_info_requests for select to authenticated
  using ( (select public.has_permission('admissions.view')) and (select private.mfa_satisfied()) );

-- application_upload_sessions: RLS enabled, NO policies (RPC-only)
```

### 3.8 Email, audit, ops

```sql
create policy email_messages_select on public.email_messages for select to authenticated
  using (
    (entity_type = 'application' and (select public.has_permission('admissions.view')))
    or (entity_type = 'enquiry' and (select public.has_permission('enquiries.view')))
    or (select public.has_permission('settings.manage'))
  );
create policy email_suppressions_select on public.email_suppressions for select to authenticated
  using ( (select public.has_permission('settings.manage')) );

create policy activity_logs_select on public.activity_logs for select to authenticated
  using ( (select public.has_permission('activity.view')) );
-- no insert/update/delete policies; writes only via log_activity() / triggers; trigger forbid_update_delete

create policy retention_runs_select on public.retention_runs for select to authenticated
  using ( (select public.has_permission('settings.view')) );
```

### 3.9 Storage (`storage.objects`)

```sql
-- media (public bucket: reads via public URL; no anon SELECT policy, so listing is impossible)
create policy media_staff_select on storage.objects for select to authenticated
  using ( bucket_id = 'media' and (select public.has_permission('media.view')) );
create policy media_insert on storage.objects for insert to authenticated
  with check ( bucket_id = 'media' and (select public.has_permission('media.create'))
               and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif|gif|svg)$' );
create policy media_update on storage.objects for update to authenticated
  using ( bucket_id = 'media' and (select public.has_permission('media.edit')) );
create policy media_delete on storage.objects for delete to authenticated
  using ( bucket_id = 'media' and (select public.has_permission('trash.purge')) );
-- SVG: accepted only after server-side sanitisation (DOMPurify SVG profile) else rejected; served with
-- Content-Type image/svg+xml from the storage domain, never inlined.

-- resources (public bucket): same four policies with resources.view/create/edit and extension
-- allow-list pdf|docx|xlsx|pptx (the office types additionally gated by content.allowOfficeDocs in the action)

-- admission-documents (private)
create policy admdocs_staff_select on storage.objects for select to authenticated
  using ( bucket_id = 'admission-documents'
          and (select public.has_permission('admissions.view'))
          and (select private.mfa_satisfied()) );
create policy admdocs_staff_delete on storage.objects for delete to authenticated
  using ( bucket_id = 'admission-documents' and (select public.has_permission('admissions.delete')) );

-- applicant slot access (D6): only the exact pending, unexpired slot path
create policy admdocs_slot_insert on storage.objects for insert to anon, authenticated
  with check ( bucket_id = 'admission-documents' and private.upload_slot_open(name) );
create policy admdocs_slot_select on storage.objects for select to anon, authenticated
  using ( bucket_id = 'admission-documents' and private.upload_slot_open(name) );
create policy admdocs_slot_update on storage.objects for update to anon, authenticated
  using ( bucket_id = 'admission-documents' and private.upload_slot_open(name) );
create policy admdocs_slot_delete on storage.objects for delete to anon, authenticated
  using ( bucket_id = 'admission-documents' and private.upload_slot_open(name) );
-- private.upload_slot_open(p text): exists application_documents where path = p and state = 'pending'
--   and expires_at > now(). Unique index on path makes it O(1).

-- private-attachments: identical pattern with enquiries.view, if enabled (Q11)
```

Bucket configuration (provisioning): `media` and `resources` are public with `file_size_limit` 20 MB, and `allowed_mime_types` set. `admission-documents` is private, with `file_size_limit` 20 MB as a hard ceiling (the app enforces the configured limit, default 10 MB) and `allowed_mime_types` = pdf, jpeg, png.

---

## 4. Server Actions & Route Handlers

### 4.0 Shared contract

```ts
// src/lib/actions/result.ts
export type ErrorCode =
  | 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'MFA_REQUIRED' | 'NOT_FOUND' | 'CONFLICT'
  | 'RATE_LIMITED' | 'BOT_DETECTED' | 'TRANSITION_DENIED' | 'FEATURED_LIMIT' | 'MEDIA_IN_USE'
  | 'ALT_TEXT_REQUIRED' | 'ESCALATION_DENIED' | 'LAST_SUPER_ADMIN' | 'INTAKE_CLOSED'
  | 'UPLOAD_REJECTED' | 'CONTRAST_TOO_LOW' | 'INTERNAL';
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> } };
```

`defineAction({ input, permission, rateLimit?, audit?, tags?, handler })` in `src/lib/actions/define.ts` implements the MP §4.2 pipeline. It catches every error, maps Postgres `SQLSTATE`/`RAISE` codes to `ErrorCode`s, and keeps raw messages out of the result.

`definePublicAction` adds these checks, in order:
1. `checkBotId()`
2. Honeypot field `website` must be empty
3. `elapsedMs ≥ 3000` (from a signed `formStartedAt` token issued at render)
4. Mint the submission ticket (D5)

**Audit** is written through the `log_activity` RPC with the `before`/`after` redacted by `lib/audit/redact.ts`. Redacted keys: `guardian_*`, `applicant_*`, `email`, `phone*`, `answers`, `message`, `body` (for enquiries), and all medical data.

**Cache tags** (`lib/cache/tags.ts`, typed builders):

| Tag | Covers |
|---|---|
| `site-settings` | branding, nav, footer, homepage config |
| `redirects` | proxy redirect map |
| `pages` / `page:<path>` | CMS pages |
| `news` / `news:<slug>` / `news-categories` | articles |
| `events` / `event:<slug>` | events |
| `academics` | all academics tables |
| `gallery` / `album:<slug>` | albums and items |
| `staff` | staff directory |
| `resources` | resource centre |
| `admissions-public` | open intakes, form versions |
| `media:<id>` | media replaced in place |
| `sitemap` | sitemap.xml |

Publish/hide/trash/restore/replace call `updateTag` (read-your-writes in the acting request) for the list and detail tags, plus `sitemap` and `site-settings` when nav is affected. Cron uses `revalidateTag(tag, 'max')`.

### 4.1 Generic content actions (factory `createContentActions(module, table, schema)`)

Generated for **pages, news, academics (levels, programmes, departments, subjects, activities), events, gallery albums, staff, resources**. M = module, `Entity` = that module's Zod schema.

| Action | Input (Zod) | Permission | Side effects |
|---|---|---|---|
| `create` | `Entity.pick(minimal: title [+ required FKs])` | `M.create` | insert draft; audit `M.create`; returns `{id}` |
| `autosaveDraft` | `{ id: uuid, baseVersion: int, data: Entity.partial() }` | `M.edit` | upsert `content_drafts`; **no** audit (noise), no revalidation; rate-limited to 1 per 5 s per entity |
| `saveDraft` | `{ id, version, data: Entity }` | `M.edit` (and `M.publish`/`approve` if the row is published, §2.3) | apply to row (status unchanged if draft); delete working copy; rebuild `media_usages`; audit `M.update` with diff; `updateTag` if the row is live |
| `submitForReview` | `{ id, version }` | `M.edit`; requires `features.contentApproval` | status→in_review; audit; enqueue "review requested" email to holders of `M.approve` |
| `sendBack` | `{ id, version, message: string ≤ 500 }` | `M.approve` | status→draft; audit; email the author |
| `publish` | `{ id, version, publishAt?: datetime }` | `M.publish` or `M.approve` (§2.3) | applies the working copy; `publishAt` in future → status `scheduled`, else `published` with `publish_at = now()`; audit `M.publish`; tags |
| `unpublish` ("Hide from website") | `{ id, version }` | same as publish | status→draft; audit `M.unpublish`; tags |
| `archive` | `{ id, version }` | same as publish | status→archived; audit; tags |
| `trash` | `{ id, version }` | `M.delete` | set `deleted_at`; audit `M.trash`; tags |
| `restore` | `{ id }` | `M.delete` | clear `deleted_at` (slug clash → suffix `-2`, warn); audit; tags |
| `purge` | `{ id, confirmTitle: string }` (must equal the title) | `trash.purge` | hard delete + storage object cleanup for owned files; audit `M.purge` |
| `duplicate` | `{ id }` | `M.create` | copy as draft "Copy of …", new slug; audit |
| `reorder` | `{ ids: uuid[] (≤ 500) }` | `M.edit` | bulk update `sort_order`; audit; tags |
| `bulk` | `{ ids: uuid[] ≤ 100, op: 'publish'|'unpublish'|'trash' }` | per op | each row individually (per-row permission + version skipped with explicit "latest" semantics); returns per-row results; one audit row with ids |
| `updateSlug` | `{ id, version, slug }` | `M.edit` (+publish if live) | trigger writes the redirect; audit |

Module-specific additions:

| Module | Action | Input | Permission | Side effects |
|---|---|---|---|---|
| news | `setFeatured` | `{id, version, featured}` | `news.publish` | `FEATURED_LIMIT` error lists current featured; tags `news` |
| news | `categories.create/update/delete/reorder` | `{name, slug?, description?}` | `news.publish` | tags `news-categories`, `news` |
| events | `categories.*` | as above | `events.publish` | |
| academics | `programmes.setSubjects` | `{programmeId, subjects: {subjectId, isCompulsory}[]}` | `academics.edit` | replace join rows; tags |
| gallery | `albums.addImages` | `{albumId, mediaIds: uuid[] ≤ 50}` | `gallery.edit` | insert items; tags `album:<slug>` |
| gallery | `albums.addVideo` | `{albumId, url}` → parsed to `{provider, videoId}` via allow-list regex | `gallery.edit` | fetch the oEmbed thumbnail server-side (allow-listed host), store `video_thumbnail_url` |
| gallery | `items.update/remove/reorder` | | `gallery.edit` | |
| staff | `contacts.update` | `{staffId, email?, phone?, showEmail, showPhone}` | `staff.edit` | trigger syncs `public_*`; audit redacts values |
| staff | `setDepartments` | `{staffId, departmentIds[]}` | `staff.edit` | |
| resources | `files.requestUpload` | `{resourceId, filename, mime, size}` | `resources.edit` | validates type/size against settings; returns a signed upload URL for `resources/{uuid}/{uuid}.{ext}` |
| resources | `files.confirm` | `{resourceId, path}` | `resources.edit` | magic-byte check (`file-type`); insert `resource_files` v+1; set current; old version retained; audit; tags |
| pages | `move` | `{id, version, parentId|null, navOrder}` | `pages.edit` | path rewrite + redirects for the subtree |

### 4.2 Media library

| Action | Input | Permission | Side effects |
|---|---|---|---|
| `media.requestUpload` | `{filename ≤ 200, mime ∈ allow-list, size ≤ 20 MB}` | `media.create` | returns `{assetId, path, signedUrl, token}`; inserts the `media_assets` row (pending) |
| `media.confirmUpload` | `{assetId}` | `media.create` | downloads the first 4 KB → magic bytes (`file-type`); images: `sharp` metadata, rotate, strip EXIF, re-upload, generate LQIP + blurhash; SVG: sanitise or reject; on failure delete the object + row; audit `media.upload` |
| `media.update` | `{id, version, altText ≤ 250, caption ≤ 500}` | `media.edit` | tags `media:<id>` + owners' tags (from usages) |
| `media.replace` | `{id, version}` then upload/confirm | `media.edit` | same id, new path, old object deleted after confirm; tags of all owners |
| `media.trash` / `restore` | `{id, version}` | `media.delete` | `MEDIA_IN_USE` lists usages with links |
| `media.list` (query, not action) | `{q?, kind?, from?, to?, page}` | `media.view` | |

Client side: images are resized in the browser to a 2,560 px long edge (`browser-image-compression`, lazy-loaded) before `requestUpload`. HEIC is converted to JPEG client-side (`heic-to`, lazy-loaded on demand).

### 4.3 Appearance & settings

| Action | Input | Permission | Side effects |
|---|---|---|---|
| `settings.updateSection` | `{section: keyof SiteSettings, version, value: SiteSettings[section]}` | `appearance.manage` for identity, theme, navigation, homepage, footer, social, seo; `settings.manage` for the rest | RPC `update_site_settings(section, value, version)` (definer: re-checks the permission, merges, bumps version); theme: **contrast validation** server-side (`lib/colour/contrast.ts`, WCAG relative luminance) → `CONTRAST_TOO_LOW` with a suggested shade; audit `settings.update` with section + diff; `updateTag('site-settings')` + `sitemap` (if seo) |
| `settings.updatePrivate` | `{version, value: PrivateSettings}` | `settings.manage` | |
| `appearance.createPreviewToken` | `{template, theme: Theme, homepage?: HomeSection[]}` | `appearance.manage` | returns an HMAC-signed token (`PREVIEW_TOKEN_SECRET`, 10 min, payload ≤ 4 KB, else stored in `content_drafts` with entity_type 'appearance' and referenced by id) |
| `homepage.updateSections` | `{version, sections: HomeSection[] (≤ 20)}` | `appearance.manage` | per-type settings validated by the registry Zod (§6.3); `media_usages` rebuilt for `site_settings` |
| `redirects.create/delete` | `{fromPath, toPath, statusCode}` | `settings.manage` | loop detection; tags `redirects` |
| `redirects.importCsv` | file ≤ 1 MB, parsed in the action (small text, under the body limit) — `from,to` rows ≤ 5,000 | `settings.manage` | per-row validation report; audit row count |

### 4.4 Users, roles, support access

| Action | Input | Permission | Side effects |
|---|---|---|---|
| `users.invite` | `{email, fullName, roleIds: uuid[] ≥ 1}` | `users.manage` (escalation checked in SQL before the job is created) | creates an `auth_admin_jobs` row; the invite is sent by the internal route (**D13**, below); rate limit 20/h; audit `users.invite` |
| `users.resendInvite` | `{userId}` | `users.manage` | same path as invite |
| `users.setRoles` | `{userId, roleIds}` | `users.manage` | diff → delete/insert `user_roles` (triggers enforce escalation and last-super-admin); audit |
| `users.deactivate` | `{userId, reason ≤ 300}` | `users.manage` | `profiles.status='deactivated'` (guard trigger); revoke sessions (D13); audit |
| `users.reactivate` | `{userId}` | `users.manage` | audit |
| `roles.create/update/delete` | `{name, description, permissionKeys[]}` | `users.manage_roles` | escalation enforced in SQL; delete is blocked while assigned |
| `support.grant` | `{granteeId, permissionKeys[] ⊆ sensitive, hours 1–168, reason}` | `users.manage_roles` and the super_admin role (trigger) | email both parties; audit `support.grant` |
| `support.revoke` | `{grantId}` | `users.manage_roles` | audit |
| `profile.updateSelf` | `{fullName}` | authenticated | |
| `auth.*` | see §4.7 | | |

> **[DEV] D13 — privileged auth admin calls.** Inviting users (`auth.admin.inviteUserByEmail`) and revoking another user's sessions (`auth.admin.signOut`) require the secret key. MP §6 itself says "call `auth.admin.signOut(userId)` from a secure route", which conflicts with CLAUDE.md's rule that `admin.ts` stays out of request paths. **Proposal:** a single internal Route Handler group `src/app/api/webhooks/internal/auth-admin/route.ts`. It is **not** called by the browser. The Server Action first runs `requirePermission('users.manage')`, writes an `auth_admin_jobs` row (RLS: insert needs `users.manage`, and the escalation check runs in SQL), then calls the route with `CRON_SECRET` from the server. The route re-reads the job row, verifies it is pending, under 60 s old and that the requester still holds `users.manage`, then performs only the `invite` / `signOut` operation and marks the job done. This keeps `admin.ts` inside `api/webhooks/*` and makes every privileged auth operation an audited, replay-proof, two-step job. **Alternative:** relax the CLAUDE.md rule for one narrowly-named file. **Needs your approval (Q12).**

### 4.5 Enquiries

| Action | Input | Permission | Side effects |
|---|---|---|---|
| `contact.submit` (public) | `{name 2–100, email, phone? (E.164 via libphonenumber-js, default UG), subject ∈ settings.contact.enquirySubjects, message 20–2000, consent: true, website: '' (honeypot), formToken}` | public pipeline (BotID, honeypot, ≥ 3 s, ticket) | RPC `submit_enquiry` (rate limits: 5/h per IP hash, 3/h per email hash) → row + 2 queued emails (inbox alert, visitor confirmation); returns `{received: true}`; **no** PII in logs |
| `enquiries.setStatus` | `{id, version, status}` | `enquiries.edit` | audit |
| `enquiries.assign` | `{id, version, assigneeId|null}` | `enquiries.edit` | email the assignee (without message content: "You have been assigned an enquiry", link) |
| `enquiries.addNote` | `{id, body ≤ 2000}` | `enquiries.edit` | |
| `enquiries.trash/restore` | | `enquiries.delete` | |
| `enquiries.export` | `{filter}` | `enquiries.export` | CSV streamed by Route Handler `GET /admin/enquiries/export` (dynamic, permission-checked); audit row count + filter |

### 4.6 Admissions

**Public flow**

| Step | Action → RPC | Input | Guards | Effect |
|---|---|---|---|---|
| 1 | `admissions.start` → `start_application(ticket, intake_id)` | `{intakeId}` | public pipeline; intake open (`opens_at ≤ now < closes_at`, published) else `INTAKE_CLOSED`; 10/h per IP | creates `application_upload_sessions` (24 h); returns `{applicationId, uploadToken}` (opaque 32-byte token; DB stores sha256); the browser keeps both in localStorage with the draft |
| 2 | `admissions.requestUpload` → `request_admission_upload(ticket, application_id, upload_token, requirement_key, mime, size)` | `{applicationId, uploadToken, requirementKey, mime ∈ {pdf,jpeg,png}, size ≤ cfg}` | token valid and unexpired; count < `maxFiles`; 30/h per session | inserts a pending `application_documents` slot (path `{applicationId}/{uuid}.{ext}`, expires 30 min); the action then calls `storage.createSignedUploadUrl(path)` with the **anon** client (passes `admdocs_slot_insert`) and returns `{documentId, signedUrl, token}` |
| 3 | browser `uploadToSignedUrl` | | | bytes go to Storage directly |
| 4 | `admissions.confirmUpload` → `confirm_admission_upload(ticket, application_id, upload_token, document_id, mime, size, sha256)` | `{applicationId, uploadToken, documentId}` | the action (anon client, slot still open) downloads the object; checks magic bytes (`%PDF-`, `FF D8 FF`, `89 50 4E 47`) **and** declared type; images: `sharp().rotate()` strips EXIF/GPS and re-uploads with `upsert`; PDFs: reject if encrypted or contains `/JavaScript` / `/Launch` / `/EmbeddedFile` (Q13: AV scanning) | RPC marks `uploaded` + records sha256/size → anon access ends. Failure: object deleted, slot `rejected`, user message "This file couldn't be checked. Please upload a PDF, JPG or PNG under 10 MB." |
| 5 | `admissions.removeUpload` → `remove_admission_upload(...)` | | pending/uploaded docs of an unsubmitted session only | object delete via a definer RPC that flips the slot to pending for 1 min, then the action deletes (slot policy) |
| 6 | `admissions.submit` → `submit_application(ticket, application_id, upload_token, payload jsonb)` | `{applicationId, uploadToken, intakeId, intakeClassId, applicant, guardian, answers, medical?, consent: {accepted: true, textVersion}}`, validated by **runtime Zod built from the pinned form version** (`buildApplicationSchema(definition)`, shared client/server), then re-validated structurally in SQL | public pipeline; 3/h per IP hash; 3/day per guardian email hash; intake still open (5-min grace after `closes_at` for in-flight forms); required documents present and `uploaded`; **any client-supplied `status`, `reference`, `submitted_at`, `id` keys in the payload → reject** (pgTAP) | inserts `applications` (status = initial, reference = generator, consent_ip_hash from ticket), `application_medical` if present **and** enabled in the form, links docs, deletes the upload session, inserts the initial `admission_status_history`, enqueues the acknowledgement + inbox alert; returns `{reference}` **only** |

**Tracking** (`features.admissionsTracking`): `admissions.track` → `track_application(ticket, reference, contact)`. The action normalises the reference (checksum first: a bad checksum returns `NOT_FOUND` without touching the DB) and the contact (email lowercased, or phone to E.164). Rate limits: 5 per 15 min per IP hash, 5 per day per reference hash. It returns `{status: public_label, colour, submittedAt, timeline: [{at, label, publicMessage}]}` or a uniform `NOT_FOUND` ("We couldn't find an application with those details"), with the same response shape and a constant ~300 ms floor delay. It never returns notes, documents or answers.

**Additional-info links**: `admissions.requestInfo` (admin, `admissions.edit`) creates `admission_info_requests` (token sha256, expires `infoRequestLinkDays`), moves the status to `info_required` through `change_application_status`, and emails the link `/admissions/upload/[token]`. The public page validates the token through `get_info_request(ticket, token)`, which returns only the requested item labels and the message. Uploads use `request_info_upload` / `confirm_info_upload`, which are the D6 slot mechanics keyed by the info-request token. `complete_info_request` marks it used (single-use) and notifies the inbox.

**Admin**

| Action | Input | Permission | Side effects |
|---|---|---|---|
| `applications.list` (query) | `{intakeId?, classId?, statusIds?, q?, from?, to?, assignedTo?, sort, page}` | `admissions.view` | never selects medical/notes |
| `applications.changeStatus` → RPC `change_application_status(id, version, to_status_id, public_message?, internal_note?, notify bool)` | | `admissions.edit` (+ `view_notes` if `internal_note`) | history row; note row; `status_changed_at`; email if `notify && status.notify_applicant`; audit `admissions.status_change` |
| `applications.assign` | `{id, version, assigneeId}` | `admissions.edit` | |
| `applications.addNote` | `{id, body}` | `admissions.view_notes` | |
| `applications.reviewDocument` | `{documentId, review}` | `admissions.edit` | |
| `applications.getDocumentUrl` | `{documentId}` | `admissions.view` (+ MFA) | user-scoped `createSignedUrl(path, 60, {download: true})`; audit `admissions.document_download` (document id, application id; no file name) |
| `applications.createManual` **[EXT]** | same payload as public, `source: 'paper'` | `admissions.create` | RPC `create_application_manual`; reference generated; no ticket needed (authenticated) |
| `applications.export` | `{filter, format: 'csv'|'xlsx', includeMedical: boolean}` | `admissions.export` (+ `view_medical` if includeMedical) | Route Handler `GET /admin/admissions/export` streams the file (`exceljs` streaming writer); CSV-injection-safe (prefix `= + - @` cells with `'`); audit `{rowCount, filter, includeMedical}` |
| `applications.exportSubject` (DSR) | `{id}` | `admissions.view` + `admissions.export` | zip (JSON + documents) built in a Route Handler that streams from Storage via the user-scoped client; audit |
| `applications.erase` (DSR) | `{id, reason ≥ 10, confirmReference}` | `admissions.delete` | RPC `anonymise_application`: replaces PII with `[erased]`, deletes medical, notes and documents (objects deleted by the action through the staff delete policy), keeps reference/intake/status for statistics; audit with reason |
| `forms.saveDraftVersion` / `forms.publishVersion` | `{formId, definition: FormDefinition}` | `admissions.manage` | publish freezes the version |
| `intakes.*` | via `createContentActions('admissions', …)` + `{opensAt, closesAt, formVersionId, classes[], requiredDocuments[]}` | `admissions.manage` | tags `admissions-public` |
| `statuses.create/update/reorder/delete` | | `admissions.manage` | delete only if unused; exactly one initial |
| `admissions.report` (query) → RPC `admissions_report(intake_id?, from, to)` | | `admissions.view` | aggregates only: by intake/class/status/day; acceptance rate = accepted ÷ (accepted + rejected); median days in the current status |

### 4.7 Auth (Server Actions in `(auth)`)

| Action | Input | Guard | Behaviour |
|---|---|---|---|
| `auth.login` | `{email, password}` | rate limit 5 per 15 min per IP hash + 10/h per email hash (`rate_limit_check_auth`); BotID | `signInWithPassword`; generic "Email or password is incorrect"; on failure count → after 5 → audit `auth.login_failed_burst`; success → `last_login_at`, audit `auth.login`; MFA enrolled → redirect `/mfa` |
| `auth.forgotPassword` | `{email}` | 3/h per IP and per email | always "If an account exists, we've sent a link" |
| `auth.resetPassword` | `{password ≥ 12, confirm}` | recovery session | Supabase leaked-password protection |
| `auth.acceptInvite` | `{fullName, password}` | invite session | profile status → active |
| `auth.mfaEnroll/verify/unenroll` | `{factorId, code}` | authenticated | `supabase.auth.mfa.*`; unenroll is blocked while MFA is required for that role |
| `auth.logout` | — | | |

Auth pages allow paste in all fields and use `autocomplete` attributes (WCAG 3.3.8).

### 4.8 Route Handlers

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | none | `{status, db: 'ok'|'fail', storage: 'ok'|'fail', version}`; no secrets; `Cache-Control: no-store` |
| `/api/cron/publish` | GET (Vercel Cron) | `Authorization: Bearer ${CRON_SECRET}` | scheduled→published where `publish_at ≤ now()`, across all LC tables; `revalidateTag` per affected slug; logs `source='cron'` |
| `/api/cron/email-dispatch` | POST/GET | CRON_SECRET | send queued emails (≤ 50 per run), honour suppressions, backoff `2^attempts × 1 min` (max 6 attempts) |
| `/api/cron/retention` | GET daily 01:30 EAT | CRON_SECRET | trash > `trashDays` purge; applications with outcome=rejected/withdrawn and intake `closes_at` + N months → anonymise; enquiries > N months → delete; activity_logs > N months; email_messages > N months; expired upload sessions + orphan objects; `retention_runs` summary |
| `/api/cron/housekeeping` | GET hourly | CRON_SECRET | rate-limit buckets, used tickets, expired slots |
| `/api/webhooks/resend` | POST | Svix signature (`RESEND_WEBHOOK_SECRET`) | update `email_messages.status`; bounce/complaint → `email_suppressions` |
| `/api/webhooks/internal/auth-admin` | POST | CRON_SECRET + job row (D13) | invite / signOut |
| `/admin/admissions/export`, `/admin/enquiries/export`, `/admin/activity/export`, `/admin/admissions/[id]/subject-export` | GET | session + `requirePermission` | streaming downloads |
| `/events/[slug]/ics` | GET | public (cached by tag) | `text/calendar`, generated with `ics` |
| `/resources/[slug]/download` | GET | public | `after(() => rpc('increment_resource_download'))`, then 302 to the public storage URL (no timing dependency on the counter) |
| `/api/draft` | GET | preview token (HMAC, 10 min) + authenticated editor | `draftMode().enable()` and redirect; `/api/draft/disable` |
| `sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx` (root + per news/event) | | public | |

Cron schedule (`vercel.json`): publish `*/5 * * * *`, email-dispatch `*/5 * * * *` (plus an immediate poke via `after()`), retention `30 22 * * *` UTC (01:30 EAT), housekeeping `0 * * * *`. Five-minute schedules need Vercel Pro (Q1).

### 4.9 Ticket-gated public RPC shape (example)

```sql
create or replace function public.submit_enquiry(
  p_ticket jsonb,            -- {issuedAt, payloadSha256, ipHash, mac}
  p_payload jsonb            -- {name, email, phone, subject, message, consentTextVersion}
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_settings jsonb; v_id uuid;
begin
  perform private.verify_ticket('enquiry', p_payload, p_ticket);               -- mac, age ≤ 120 s, single-use
  perform private.rate_limit_hit('enq:ip:' || (p_ticket->>'ipHash'), 5, 3600);
  perform private.rate_limit_hit('enq:em:' || encode(extensions.digest(lower(p_payload->>'email'),'sha256'),'hex'), 3, 3600);
  if p_payload ?| array['status','id','created_at','assigned_to'] then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  select data into v_settings from public.site_settings where id = 1;
  if not (p_payload->>'subject') = any (select jsonb_array_elements_text(v_settings->'contact'->'enquirySubjects')) then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  insert into public.contact_messages (name, email, phone_e164, subject, message, ip_hash,
                                       consent_text_version, consented_at)
  values (left(p_payload->>'name',100), p_payload->>'email', nullif(p_payload->>'phone',''),
          p_payload->>'subject', p_payload->>'message', p_ticket->>'ipHash',
          p_payload->>'consentTextVersion', now())
  returning id into v_id;      -- CHECK constraints enforce lengths/format
  perform private.enqueue_email('enquiry.alert', 'enquiry', v_id, …);
  perform private.enqueue_email('enquiry.confirmation', 'enquiry', v_id, …);
  return jsonb_build_object('received', true);
end $$;
revoke all on function public.submit_enquiry(jsonb, jsonb) from public;
grant execute on function public.submit_enquiry(jsonb, jsonb) to anon, authenticated;
```

### 4.10 Emails (React Email, `src/emails/`)

| Key | To | Content rule |
|---|---|---|
| `enquiry.confirmation` | visitor | echoes the subject only, never the message |
| `enquiry.alert` | inbox | name, subject, link to the admin; **no message body** (the inbox might be shared; Q14) |
| `application.acknowledgement` | guardian | reference, intake, class, tracking link, `acknowledgementMessage` |
| `application.alert` | admissions inbox | reference, intake, class, link; no applicant PII beyond first name |
| `application.status.<key>` | guardian | public label + public message |
| `application.info_request` | guardian | single-use upload link, expiry date |
| `content.review_requested` / `content.sent_back` | staff | |
| `users.invite` (Supabase template, branded) / `support.grant` | staff | |

All emails are branded from `site_settings` (logo, primary colour, name) and have a plain-text part.

### 4.11 Admissions form definition (shared Zod)

```ts
export const FieldType = z.enum(['text','email','phone','date','select','radio','checkbox','textarea','file']);
export const FormField = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
  type: FieldType,
  label: z.string().min(2).max(120),
  helpText: z.string().max(300).optional(),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string().max(60), label: z.string().max(120) })).max(50).optional(),
  validation: z.object({ minLength: z.number().int().optional(), maxLength: z.number().int().max(5000).optional(),
                         minDate: z.string().optional(), maxDate: z.string().optional() }).optional(),
  showIf: z.object({ fieldId: z.string(), equals: z.union([z.string(), z.boolean()]) }).optional(),
  documentKey: z.string().optional(),      // file fields map to intake.required_documents[].key
});
export const FormStep = z.object({
  key: z.enum(['applicant','guardian','academic','medical','documents']),
  title: z.string(), enabled: z.boolean(), fields: z.array(FormField).max(40),
});
export const FormDefinition = z.object({
  steps: z.array(FormStep).length(5),     // fixed order; review & consent is always last and not configurable
  coreFieldLabels: z.record(z.string(), z.string()).optional(),  // relabel built-ins, can't remove them
}).superRefine(/* unique ids, showIf targets exist and precede, medical step enabled → ⚠ DPPA flag */);
```

Core fields (applicant name/DOB, guardian name/relationship/email/phone, intake class) are always present and map to columns. Configured fields go to `answers`, or to `application_medical.answers` for the medical step. `buildApplicationSchema(def, intake)` returns the per-step Zod schemas. It is unit-tested against fixtures and shared by RHF (client) and the action (server).

---

## 5. Page-by-page requirements

### 5.0 States every page must define

| State | Public | Admin |
|---|---|---|
| Loading | streamed skeletons matching the final layout (CLS 0); `loading.tsx` only where a whole segment suspends | skeleton rows; buttons show a spinner + "Saving…" |
| Empty | a friendly message + a link to a related section ("No upcoming events. See past events →"); empty sections on the homepage are **hidden**, never shown empty | teaching empty state (MP §11) + primary CTA if the user has `M.create` |
| Error | `error.tsx` per segment: "Something went wrong loading this page. Try again" + retry; `not-found.tsx` with search + home links; **never** stack traces | inline `Alert` + retry; toast for action errors; form field errors via `aria-describedby` + summary with an `aria-live="assertive"` region |
| Forbidden | — | `forbidden.tsx` ("You don't have access to this section. Ask your administrator.") using Next's `forbidden()` |
| Offline (admin) | — | `navigator.onLine` banner + save indicator "Not saved — check your connection"; autosave retries with backoff |

Public caching: every public page = static shell + `'use cache'` data loaders (`cacheLife('hours')`, tags §4.0). Pages that read `searchParams` (search, filters, pagination) render the shell statically and stream the result list inside `<Suspense>`. `draftMode()` bypasses the cache and shows the preview banner + `X-Robots-Tag: noindex`.

### 5.1 Public — `src/app/(public)`

| Route | Content & behaviour | Data / tags | Notes |
|---|---|---|---|
| `layout.tsx` | template `Header`/`Footer` from the registry; skip link; `<html>` CSS vars; JSON-LD `EducationalOrganization` subtype (homepage only) | `site-settings` | theme vars computed server-side (§6.2) |
| `/` | ordered visible `HomeSection`s rendered by the active template's components | sections' own loaders (`news`, `events`, `gallery`, `staff`, …) | hero image `priority`; video hero poster-backed, muted, pausable; hidden if its data is empty |
| `/about` + `/about/[...path]` | page tree under `system_key='about'`; sidebar nav of siblings in the `with_sidebar` layout; leadership block on the root if configured | `pages`, `page:<path>` | BreadcrumbList |
| `/search` | header search box → results grouped by type (pages, news, events, resources), 10 per group; `?q=` (2–100 chars); empty → popular links | dynamic list in `<Suspense>` over `site_search()`; `noindex` | PRD §4.2 A |
| `/academics` | levels overview → `/academics/[level]` (programmes) → `/academics/[level]/[programme]` (subjects grouped by department, compulsory/optional) · `/academics/departments/[slug]` · `/academics/subjects` (all subjects by department) · `/academics/curriculum` (page) · `/academics/activities` (filter chips by category) · `/academics/exams/...` (pages) | `academics` | curriculum badges |
| `/admissions` + `/admissions/requirements` + `/admissions/process` | Admission Information / Requirements / Application Process system pages (PRD §20), open intakes list with dates, "Apply now" per intake; closed → next opening date + `closedMessage` | `admissions-public` | |
| `/admissions/apply/[intake]` | **dynamic** (no cache); multi-step form (§5.3) | form version (cached) + per-request ticket token | `noindex` |
| `/admissions/apply/[intake]/done` | reference shown large + copy button + "Save this number" + tracking link; no PII | | |
| `/admissions/track` | reference + email/phone → status timeline | dynamic | hidden (404) if tracking is off; `noindex` |
| `/admissions/upload/[token]` | single-use info upload | dynamic | `noindex`; expired → clear message + school contact |
| `/news` | featured (≤ N) + list, category chips, search box (FTS), pagination (12/page; `?page=`) | `news` | `rel=prev/next` not needed; canonical without `?page=1` |
| `/news/[slug]` | title, date (school tz), category, reading time, cover (alt), body (static renderer), share links (WhatsApp first), related (same category, 3) | `news:<slug>` | NewsArticle JSON-LD, OG image |
| `/news/category/[slug]` | filtered list | `news` | |
| `/events` | agenda list (mobile default) / month grid toggle (desktop default; `?view=month&month=2027-03`); upcoming by default; past by term/year | `events` | grid is a table with proper headers, keyboard-navigable |
| `/events/[slug]` | details, date/time in school tz, venue + map link, .ics + Google Calendar link | `event:<slug>` | Event JSON-LD |
| `/gallery` | albums grid with category chips | `gallery` | |
| `/gallery/[slug]` | responsive grid, lightbox (client leaf; focus trap, arrows, Esc, captions, swipe), video facades | `album:<slug>` | lazy below the fold, blur placeholders |
| `/staff` | leadership first (by `leadership_order`), then by department; cards; public email/phone only if shown | `staff` | Person JSON-LD within the org |
| `/staff/[slug]` | profile | `staff` | |
| `/resources` | category chips, search, list with type/size/date and a "Download" link → `/resources/[slug]/download` | `resources` | |
| `/contact` | details, opening hours, static map + "Open in Google Maps", click-to-load interactive map, enquiry form (client leaf) | `site-settings` | DPPA notice above submit |
| `/legal/privacy`, `/legal/terms` | system pages | `pages` | the privacy page must list the processors + regions (§8 of MP) — seeded stub with clear placeholders for the lawyer |
| `/[...slug]` | any other CMS page by `path` | `page:<path>` | not-found if no match; redirects resolved earlier in `proxy.ts` |
| `/preview/template/[key]` | §6.4 | dynamic | `noindex`, `frame-ancestors 'self'` (an override of the global `none`, for this route only) |

### 5.2 Auth — `src/app/(auth)`
`/login`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/mfa` (challenge + enrolment). Altrastate admin branding plus the school logo. No public sign-up route exists. All are `noindex`. A successful login goes to `?next=` (same-origin paths only) or `/admin/overview`.

### 5.3 Admissions multi-step form (public)
- Steps: **Applicant → Parent/guardian → Academic → Health (only if enabled) → Documents → Review & consent**. There is a progress indicator ("Step 2 of 6"), as an ordered list with `aria-current="step"`.
- Each step validates with its own Zod slice. Errors show as a summary at the top (focus moves to it) plus inline messages.
- The draft is held in localStorage (`altrastate:adm:<intake>`: values + applicationId + uploadToken, excluding file bytes) with the banner "Your progress is saved on this device." There is a "Start again" control (clears it). The draft expires with the upload session (24 h) and the user is told so.
- **Redundant entry** (3.3.7): the guardian's address/phone can be reused for the emergency contact by a checkbox. The review step shows everything, with "Change" links back to each step.
- Phone input defaults to +256 and stores E.164. Dates use three native fields (day/month/year), which work better on low-end Android than a date picker.
- Documents: one row per required document, with a status (Not uploaded / Uploading 45% / Checking / Uploaded ✓ / Problem + reason), retry and remove. Camera capture is allowed (`accept="image/*,application/pdf"`).
- Consent: a checkbox with the full consent text (versioned, from settings) including the DPPA s.8 guardian statement and the s.19 cross-border notice. Submit stays disabled until it is ticked.
- Success page as in §5.1. After a submit failure the data stays in localStorage.
- JS budget: the form route may load up to 150 KB gzipped, because it is the only heavy public route (RHF + Zod + phone lib). This is an exception to the 120 KB budget and is recorded in an ADR (Q15).

### 5.4 Admin — `src/app/admin` (all dynamic; `requirePermission` in each page and action)

`layout.tsx`: a sidebar filtered by permission (items with no `.view` hidden), a top bar (school name, "View website", user menu, MFA status), a breadcrumb, a toast region and an offline banner. Below 1024 px the sidebar is a drawer. Altrastate branding applies here.

| Route | Permission | Content | Key states |
|---|---|---|---|
| `/admin/overview` | any staff | PRD §6.1 count tiles (published news, total and pending applications, upcoming events, published resources, recent enquiries) plus actionable tiles (MP §5.10), each shown only if permitted: applications pending > N days, new enquiries, next event, scheduled items in the next 48 h, items in review, retention not configured ⚠, email bounces; recent activity (if `activity.view`) | empty: "All caught up" |
| `/admin/pages` | pages.view | tree view (drag to reorder/nest + keyboard "Move up/down/in/out" buttons), status badges | |
| `/admin/pages/[id]` | pages.view (edit if pages.edit) | editor: title, slug, Tiptap body, layout, parent, show in nav, SEO panel, cover; status bar (save state, version, last editor); action bar (Save draft · Preview · Submit for review / Publish to website · Schedule · Hide from website · Move to Trash) by permission | conflict dialog on `CONFLICT`; working-copy banner "You have unpublished changes" |
| `/admin/news`, `/news/[id]`, `/news/categories` | news.* | list (search/filter chips/sort/pagination 25/bulk, cards < 768 px); editor + featured toggle + excerpt + category | `FEATURED_LIMIT` dialog listing the current featured |
| `/admin/academics/{levels,programmes,departments,subjects,activities}` + `[id]` | academics.* | tabbed; programme editor has a subject picker (compulsory/optional) | |
| `/admin/events`, `[id]`, `categories` | events.* | list + calendar preview; all-day toggle switches the inputs; times entered in school tz | |
| `/admin/gallery`, `[id]` | gallery.* | album editor + bulk uploader (50/batch, per-file progress/retry) + reorder grid + video URL add | |
| `/admin/staff`, `[id]` | staff.* | list with leadership filter; editor with private contact + show toggles | |
| `/admin/resources`, `[id]` | resources.* | editor + version history list (download older versions, "Make current") | |
| `/admin/enquiries`, `[id]` | enquiries.view | inbox (status chips, assigned to me), detail with notes + "Mark replied" + "Reply by email" (`mailto:`; v1 does not send replies from the system, Q16) | |
| `/admin/admissions` | admissions.view | list (filters: intake, class, status, date, assigned; search name/reference); bulk status change (`edit`) | |
| `/admin/admissions/[id]` | admissions.view | summary, applicant/guardian/answers, medical tab (only with `view_medical`), documents (view → 60 s URL), timeline (status history), notes (with `view_notes`), email delivery status, actions (change status with message preview, request info, assign, export subject, erase) | |
| `/admin/admissions/intakes`, `forms`, `statuses`, `reports` | admissions.manage / view | form builder (field palette of fixed types, step tabs, live preview, publish version); reports (charts + table fallback, CSV) | |
| `/admin/media` | media.view | grid/list, search, filters, details drawer (alt, caption, used in, replace, trash) | alt-missing badge |
| `/admin/appearance` | appearance.view | tabs: Template (cards + preview), Brand (logo, favicon, colours with live contrast check, fonts, radius, density), Homepage (sections dnd + settings panel), Navigation, Footer, Social, SEO; split view with an iframe preview at 360/768/1280 | |
| `/admin/users`, `[id]`, `roles`, `roles/[id]`, `support-access` | users.* | invite, roles editor (permission checklist grouped by module, with plain-language descriptions; non-grantable ones disabled with an explanation) | last-super-admin guard message |
| `/admin/settings` | settings.view | tabs: School details, Contact, Admissions, Features, Locale, Retention & privacy, Redirects (+ CSV import), Email (deliverability status) | |
| `/admin/activity` | activity.view | filterable log (actor, action, entity, date range), export | |
| `/admin/trash` | any `.delete` | items trashed in the last `trashDays`, restore / purge | |
| `/admin/account` | self | profile, password change, MFA enrolment | |

---

## 6. Template/theme contract & homepage section registry

### 6.1 Types (`src/features/templates/types.ts`)

```ts
import type { ComponentType } from 'react';
import type { SiteSettings, HomeSection, HomeSectionType } from '@/features/cms/settings/schema';

export type TemplateKey = SiteSettings['theme']['template'];

/** Fully resolved, presentation-ready data. Templates never fetch. */
export interface ShellData {
  identity: SiteSettings['identity'] & { logo: ImageRef | null };
  navigation: ResolvedNavItem[];          // pageId → href resolved, invisible removed
  footer: SiteSettings['footer'];
  contact: SiteSettings['contact'];
  social: SiteSettings['social'];
  attribution: SiteSettings['attribution'];
  currentPath: string;
}
export interface ImageRef { src: string; width: number; height: number; alt: string; lqip?: string }

export type SectionData = {
  hero: { slides: HeroSlide[]; autoplaySeconds: number | null };
  introduction: { heading: string; body: RenderedRichText; image: ImageRef | null; cta?: Link };
  quickInfo: { items: { icon: IconKey; label: string; value: string; href?: string }[] };
  latestNews: { heading: string; articles: NewsCard[]; viewAllHref: string };
  upcomingEvents: { heading: string; events: EventCard[]; viewAllHref: string };
  academicOverview: { heading: string; levels: LevelCard[] };
  galleryPreview: { heading: string; images: ImageRef[]; albums: AlbumCard[] };
  admissionsCta: { heading: string; body: string; openIntake: IntakeCard | null; cta: Link };
  leadershipMessage: { heading: string; person: PersonCard; message: RenderedRichText };
  statistics: { items: { value: string; label: string }[] };
  testimonials: { items: { quote: string; name: string; role?: string; image?: ImageRef }[] };
  customRichText: { heading?: string; body: RenderedRichText; layout: 'narrow' | 'wide' };
};

export type SectionProps<T extends HomeSectionType> = {
  id: string; data: SectionData[T]; locale: { timezone: string; dateFormat: string };
};
export type SectionComponent<T extends HomeSectionType> = ComponentType<SectionProps<T>>;

export interface TemplateDefinition {
  key: TemplateKey;
  label: string;
  description: string;
  previewImage: string;                   // static import from the template folder
  Header: ComponentType<{ shell: ShellData }>;
  Footer: ComponentType<{ shell: ShellData }>;
  PageFrame: ComponentType<{ shell: ShellData; layout: 'default' | 'wide' | 'with_sidebar';
                             title: string; breadcrumbs: Crumb[]; sidebar?: React.ReactNode;
                             children: React.ReactNode }>;
  sections: { [K in HomeSectionType]?: SectionComponent<K> };   // missing → shared fallback
  supportedSections: readonly HomeSectionType[];
  tokensCssHref?: never;                  // tokens.css is imported statically by the template module
  defaults: { fontHeading: FontKey; fontBody: FontKey; radius: Radius; homepage: HomeSection[] };
}
```

`RenderedRichText` is the React node output of `@tiptap/static-renderer`, produced in the shared loader. Templates receive nodes and never JSON.

### 6.2 Theme token pipeline
1. `getSiteSettings()` → `theme`.
2. `buildThemeVars(theme)` (pure, unit-tested) returns `--brand-primary`, `--brand-primary-fg` (black or white, whichever has the better contrast), `--brand-secondary`, `--brand-secondary-fg`, `--brand-accent`, derived tints/shades (OKLCH, `-50…-900`), `--radius`, `--density-scale`, `--font-heading`, `--font-body` (next/font variables).
3. The root layout emits a nonce'd `<style>:root{…}</style>` in `<head>` containing these variables. It is server-rendered, so there is no flash of unstyled theme. A `style=""` attribute on `<html>` is avoided because it would require `style-src-attr 'unsafe-inline'` under the strict CSP.
4. Each template's `tokens.css` maps the brand vars into its semantic tokens (`--surface`, `--heading`, `--link`, `--focus-ring`…) inside `@theme inline`. The Tailwind utilities used by templates reference only the semantic tokens.
5. Fonts: all allow-listed families are declared with `next/font/google` in `src/lib/fonts.ts`, with `preload: false` except the two selected ones. The selected families' variables are applied, and a max of 4 weights is defined in total per family pair.

### 6.3 Homepage section registry (`src/features/templates/shared/sections.ts`)

```ts
export const sectionRegistry = {
  hero: {
    label: 'Hero banner', max: 1,
    settings: z.object({
      slides: z.array(z.object({
        kind: z.enum(['image','video']),
        mediaId: z.string().uuid(),                       // image, or video poster
        videoMediaId: z.string().uuid().optional(),       // mp4 in media bucket (≤ 8 MB, muted)
        heading: z.string().max(80), subheading: z.string().max(160).optional(),
        cta: LinkSchema.optional(),
      })).min(1).max(5),
      autoplaySeconds: z.number().int().min(4).max(15).nullable().default(7),
    }),
    load: loadHero,                                       // resolves media → ImageRef
  },
  introduction:      { label: 'Welcome / introduction', max: 1, settings: …, load },
  quickInfo:         { label: 'Quick facts', max: 1, settings: z.object({ items: … .max(6) }), load },
  latestNews:        { label: 'Latest news', max: 1, settings: z.object({ heading, count: z.number().int().min(2).max(6), categoryId: z.string().uuid().nullable() }), load },
  upcomingEvents:    { label: 'Upcoming events', max: 1, settings: z.object({ heading, count: 2..6 }), load },
  academicOverview:  { label: 'Academic overview', max: 1, settings: …, load },
  galleryPreview:    { label: 'Photo gallery', max: 1, settings: z.object({ heading, source: z.enum(['latest','album']), albumId: … }), load },
  admissionsCta:     { label: 'Admissions call-to-action', max: 1, settings: …, load },
  leadershipMessage: { label: "Head teacher's message", max: 1, settings: z.object({ staffId, heading, message: TiptapDoc }), load },
  statistics:        { label: 'Key numbers', max: 1, settings: z.object({ items: … .min(2).max(6) }), load },
  testimonials:      { label: 'Testimonials', max: 1, settings: …, load },
  customRichText:    { label: 'Text block', max: 5, settings: z.object({ heading, body: TiptapDoc, layout }), load },
} satisfies { [K in HomeSectionType]: SectionDef<K> };
```

- `HomeSection.settings` is validated by the `settings` schema of its `type`, through a discriminated parse in `homepage.updateSections`.
- Each `load` runs inside `'use cache'` with its tags. It returns `null` when there's nothing to show, and the renderer then skips that section.
- A section the active template doesn't support is rendered by `shared/fallbacks/*`, so switching templates never drops content (the Phase 3 test asserts this).

### 6.4 Template preview
`/admin/appearance` → `appearance.createPreviewToken` → iframe `src="/preview/template/<key>?t=<token>"`. The route:
1. Verifies the HMAC and expiry, plus an authenticated session holding `appearance.view` (cookies; dynamic route).
2. Merges the token's theme and homepage overrides over the saved settings in memory.
3. Renders the real homepage with the candidate template.

It never writes. It sends `noindex` and `frame-ancestors 'self'`.

### 6.5 Visual direction
These are as MP §3.3. Original designs only. Each template ships `preview.png` (1280 × 800) generated by Playwright from demo content. Mockups: Q8.

---

## 7. Provisioning a new school

### 7.1 Inputs (`scripts/provision/school.config.ts`, validated by Zod, **not committed**: kept in Altrastate's private ops repo)
`slug`, `name`, `shortName`, `referencePrefix`, `domain`, `wwwRedirect: 'apex→www' | 'www→apex'`, `supabaseRegion`, `supabaseOrgId`, `vercelTeamId`, `firstSuperAdmin: {email, fullName}`, `templateKey`, `brand: {primary, secondary}`, `timezone`, `emailFromName`, `admissionsInbox`, `enquiryInbox`, `ownership: 'managed' | 'handover'` (Q2).

### 7.2 Script steps (`npm run provision -- --config <path> [--dry-run] [--resume-from <step>]`)

Each step is idempotent and records its state in `./.provision/<slug>.json`. On failure the script stops; a re-run resumes.

1. **Preflight**: the tools exist (supabase CLI, vercel CLI); the tokens are present in the operator's env (`SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `RESEND_API_KEY` (account)); the domain resolves; the region latency probe (MP §2) runs and prints the measured RTT to candidate regions.
2. **Supabase project**: Management API `POST /v1/projects` (region, plan); waits until `ACTIVE_HEALTHY`; records `project_ref`.
3. **Auth config** (Management API `PATCH /v1/projects/{ref}/config/auth`): disable sign-up, password min 12, leaked-password protection, email confirmations, OTP expiry, site URL + redirect allow-list (`https://<domain>/**`), MFA TOTP enabled, rate limits, custom SMTP → Resend.
4. **API keys**: create the publishable and secret keys (`/v1/projects/{ref}/api-keys`); disable the legacy keys.
5. **Schema**: `supabase link --project-ref` → `supabase db push` (all migrations).
6. **Vault secrets**: `form_signing_secret`, `ip_hash_salt`, `ref_feistel_key` (random 32 bytes each) through `vault.create_secret` (SQL over a direct connection).
7. **Seed**: `supabase/seed/production.sql`. It contains roles, permissions, role_permissions, the 7 PRD statuses, the PRD default news categories (§5.2) and gallery categories (§5.6), default resource categories, and default form v1 (PRD §5.1 fields; medical step disabled). It also creates the PRD §20 system pages as drafts: About › School Overview / History / Vision and Mission / Core Values / Leadership; Academics › Curriculum / Examination Information; Admissions › Admission Information / Requirements / Application Process; Legal › Privacy Policy / Terms of Use + `site_settings` built from the config (Zod-validated) + `site_settings_private`.
8. **Storage**: create the buckets with limits and MIME types (the policies come from migrations).
9. **Resend**: create the domain → print the SPF/DKIM/DMARC records → poll verification (it can be resumed later; go-live is blocked until verified); create the webhook → secret.
10. **Vercel**: create a project linked to the GitHub repo, production branch = the release tag/branch (MP §13); set env vars for Production (§9 of MP + `FORM_SIGNING_SECRET`, `IP_HASH_SALT`) **from generated values, never echoed to stdout**; add the domain(s) and print the DNS records; Cron is enabled through `vercel.json`; enable Web Analytics; set up the WAF rate-limit rules (if the plan allows).
11. **Deploy**: trigger a production deployment and wait.
12. **First Super Admin**: insert the invite job (D13) → invite email (one-time link; no password ever sent).
13. **Smoke**: `npm run smoke -- --url https://<domain>` (Playwright, tagged `@smoke`: home 200, security headers present, robots, sitemap, /api/health ok, contact form renders, admissions page renders, /admin redirects to login).
14. **Registry**: append to `installations.json` in the private ops repo (`slug, domain, projectRef, region, vercelProjectId, version, goLiveDate: null, ownership`).
15. **Checklist output**: print the remaining manual items.

### 7.3 Go-live checklist (`docs/runbooks/new-school.md`)
DNS live + HTTPS · www redirect · Resend domain verified (SPF/DKIM/DMARC pass, test email) · first Super Admin logged in + MFA enrolled · branding/content entered · legal texts reviewed by the school's lawyer (Privacy lists processors + regions) · admissions consent text approved · retention periods set · **PDPO registration (school as controller; Altrastate as processor)** · `seo.indexable` switched on · backups confirmed + PITR (if plan) · uptime monitor + alert routing · Lighthouse/axe run on production · old-site redirects imported · training delivered · school content approved before launch (PRD §18) · handover pack (§7.5) · `installations.json` go-live date.

### 7.4 Environment variables (final list)
MP §9 plus **[EXT]**: `FORM_SIGNING_SECRET` (D5; also in Vault), `IP_HASH_SALT` (D10; also in Vault). The ops-only provisioning tokens are never in the app env. `src/lib/env.ts` exports two separately validated objects, `serverEnv` (imports `server-only`) and `publicEnv`, and the build fails on a missing var.

### 7.5 Documentation & handover (PRD §17)
- **Admin guide** (`docs/admin-guide/`, one page per topic, linked from the "?" popovers), covering the PRD §17.1 topics: logging in, updating the homepage, publishing announcements, uploading photographs, creating events, managing admissions, updating staff profiles, uploading resources, managing contact information, managing authorised users.
- **Technical docs** (`docs/`), covering PRD §17.2: architecture (ADRs), database schema (generated from migrations by `npm run docs:schema`), env vars (`.env.example` + `docs/runbooks/env.md`), deployment (`new-school.md`), backup and restore (`backup-restore.md`), auth configuration, RLS policies (generated listing from `pg_policies`), API/route handlers (§4.8), upgrades (`fleet-upgrade.md`), troubleshooting.
- **Handover package**, covering PRD §17.3:
  - the production website URL
  - the configured first administrator account (invite accepted, MFA enrolled)
  - CMS access instructions
  - the admin guide (PDF export)
  - technical documentation as agreed
  - domain and hosting information
  - the agreed credential-transfer procedure: a one-time secret-sharing link or an in-person handover, **never** email or docs
  - support and maintenance information (SLA, contact, update cadence)

---

## 8. Test plan

### 8.1 Layers & tools

| Layer | Tool | Location | Runs in CI |
|---|---|---|---|
| Unit | Vitest | `src/**/__tests__/*.test.ts` | every push |
| DB / RLS / RPC | pgTAP via `supabase test db` (local Supabase in CI with Docker) | `supabase/tests/*.sql` | every push |
| Integration (actions against local Supabase) | Vitest + local Supabase, a test-user factory signing in real JWTs | `src/**/__tests__/*.int.test.ts` | every push |
| E2E + a11y | Playwright + `@axe-core/playwright` (chromium, webkit, mobile Android emulation at 360 px) | `e2e/` | PR + main (against a local prod build + local Supabase) |
| Perf | Lighthouse CI (Slow 4G, mid-tier mobile) | `.lighthouserc.json` | preview deployments |
| Security | npm audit gate, gitleaks, Semgrep (`p/nextjs`, `p/typescript`), ESLint guards, a grep for school-specific values, Supabase Advisors (Management API `GET /v1/projects/{ref}/advisors/{security|performance}` against the dev project) | CI | |
| Smoke | Playwright `@smoke` | `e2e/smoke` | provisioning + fleet upgrade |

### 8.2 pgTAP suite (MP §7.3 minimum + additions)

| File | Asserts |
|---|---|
| `00_rls_enabled.sql` | every table in `public` has RLS on; no table has zero policies **unless** it is in the RPC-only allow-list (`application_upload_sessions`) |
| `01_policy_uid_initplan.sql` | no `pg_policies.qual/with_check` contains `auth.uid()` not wrapped in `(select …)` (regex over the deparsed text); same for `auth.jwt()` |
| `02_definer_search_path.sql` | every `security definer` function in `public`/`private` has `proconfig` containing `search_path=""` |
| `03_policy_text.sql` | the LC policies on each table equal the template |
| `10_anon_reads.sql` | anon **cannot** read: draft/scheduled/archived/trashed rows of every content table, future `publish_at` rows, `admission_notes`, `applications`, `application_medical`, `application_documents`, `contact_messages`, `enquiry_notes`, `activity_logs`, `profiles`, `user_roles`, `staff_contacts`, `email_messages`, `site_settings_private`, the non-granted `media_assets` columns. Anon **can** read published rows. |
| `11_anon_writes.sql` | anon INSERT/UPDATE/DELETE on every table fails (privilege or RLS) |
| `20_role_isolation.sql` | content_editor and events_manager can't read admissions or enquiries; events_manager can't write news; content_editor can't write events; a custom role with `admissions.view` but no `view_notes` can't read notes; a role without `view_medical` reads 0 medical rows; read_only_staff can't write anything; headteacher can approve but can't create content |
| `21_deactivated.sql` | a deactivated user (valid JWT) reads nothing protected and `has_permission` returns false for every key |
| `22_escalation.sql` | a user can't insert into user_roles for themselves; school_admin can't assign super_admin; `manage_roles` holder can't add a permission they lack to a custom role; system roles are immutable; last active super_admin can't be removed/deactivated |
| `23_mfa.sql` | with `mfaRequiredForAdmins`, an aal1 JWT reads 0 applications; aal2 reads them |
| `24_support_access.sql` | platform_support has no sensitive access without a grant; has it within the window; loses it after expiry/revoke; non-super-admin can't grant |
| `30_lifecycle.sql` | each transition in §2.3 allowed/denied per role and approval flag; version increments; slug change writes a redirect; featured cap |
| `31_append_only.sql` | UPDATE/DELETE on activity_logs, status_history, admission_notes fail even for super_admin |
| `40_submit_application.sql` | rejects bad/expired/replayed ticket; rejects payload with `status`/`reference`/`id`/`submitted_at` keys; rejects a closed intake; rejects missing required docs; sets the initial status + reference server-side; returns only `{reference}`; rate limit trips |
| `41_reference.sql` | format regex; Luhn check validity; 100k generated refs unique; Feistel bijectivity on a sample; consecutive refs not consecutive |
| `42_tracking.sql` | wrong contact → same `NOT_FOUND` shape; never returns notes/documents; rate limit |
| `43_upload_slots.sql` | anon can insert/select only an open slot path; not after `uploaded`; not after expiry; not another application's path (IDOR) |
| `44_storage_staff.sql` | a content_editor can't select admission-documents objects; admissions_officer can |
| `50_submit_enquiry.sql` | ticket, subject allow-list, length checks, rate limit |

Each security test is written **first and shown failing** (red run output pasted into the phase report) before its policy/function exists (MP Phase 2).

### 8.3 Unit tests (selection)
Zod schemas (SiteSettings, FormDefinition, every module entity) with valid/invalid fixtures · `buildApplicationSchema` (conditional fields, required docs) · `buildThemeVars` + contrast (known WCAG pairs) · reference normalisation + Luhn (TS mirror of SQL) · redaction (no PII keys survive) · slugify · reading time · excerpt generation · `.ics` output · date rendering in Africa/Kampala incl. all-day · Tiptap static rendering (allow-list: unknown nodes dropped; `javascript:` links stripped; external links get `rel`) · upload validation (magic-byte fixtures incl. a polyglot, a renamed .exe, an EXIF-GPS JPEG, a PDF with JS) · CSV injection escaping · the result-error mapper (no raw messages leak) · nav resolution · the section registry fallback.

### 8.4 Integration tests (actions)
Every action: (a) unauthenticated → `UNAUTHENTICATED`; (b) wrong role → `FORBIDDEN`; (c) invalid input → `VALIDATION` with fieldErrors; (d) happy path writes the row **and** an `activity_logs` row; (e) stale version → `CONFLICT`. Generated from a table-driven spec (`actionsMatrix.ts`) so no action is skipped. A test asserts every exported action is listed in the matrix.

### 8.5 E2E (Playwright, all with an axe scan → zero violations at the WCAG 2.2 AA tags)
Public: the homepage on each of the 4 templates (360 + 1280 screenshots) · news list/search/article · events agenda/month/.ics · gallery lightbox via keyboard only · staff · resources download · contact submit (success + validation + honeypot rejection) · admissions full journey with uploads on a 360 px viewport, reload mid-form (resume from localStorage), submit, see the reference, track · info-request link (single use) · CMS page + redirect after a slug change · preview banner + noindex in draft mode. Admin: login + MFA · role-based sidebar visibility per role · create → autosave → publish → visible publicly within one revalidation · schedule → cron route → published · conflict dialog with two contexts · trash/restore · media alt-text enforcement · homepage reorder via keyboard only · template switch (+ the DB-unchanged checksum test, Phase 3) · contrast rejection · invite user · deactivate → session revoked · status change → email queued · document download audited · export audited.

Security E2E: IDOR on `/admin/admissions/[otherId]` with a content editor (403); signed-URL reuse after 60 s fails; tracking enumeration is throttled; CSP header present and no inline-script violations (listen to `securitypolicyviolation`); `/admin` is not cacheable (`Cache-Control: private, no-store`).

### 8.6 PRD §15 acceptance matrix (seed of `docs/acceptance/matrix.md`)

| AC | PRD §15 criterion | Verified by |
|---|---|---|
| P1 | All agreed public pages are available | E2E `public/sitemap.spec`: every PRD §20 route returns 200 with an h1; sitemap.xml lists them |
| P2 | Navigation works correctly | E2E nav (desktop + 360 px menu, keyboard); nav-config unit tests |
| P3 | Website is responsive | screenshots 360/768/1280 per template; axe reflow; no horizontal scroll check |
| P4 | Published content appears correctly | E2E publish → visible within one revalidation; drafts/scheduled not visible (pgTAP 10) |
| P5 | Contact information is accurate | E2E settings change → header/footer/contact page update; JSON-LD contact test |
| P6 | Forms are functional | E2E contact + admissions + tracking + search |
| P7 | Events display correctly | E2E agenda/month/detail; unit tz + all-day rendering; .ics test |
| P8 | Resources download correctly | E2E download (status 302 → 200, content-type), counter increments |
| P9 | Gallery content loads properly | E2E album + lightbox keyboard; Lighthouse on album |
| P10 | Search engine metadata is configured | Lighthouse SEO = 100; metadata/JSON-LD/robots/sitemap unit tests |
| C1 | Administrators can log in securely | E2E login + MFA; rate-limit + generic error tests; pgTAP 21 |
| C2 | Administrators can manage pages | E2E pages CRUD, nesting, slug redirect |
| C3 | News can be created, edited and published | E2E news lifecycle incl. schedule + approval |
| C4 | Events can be managed | E2E events CRUD |
| C5 | Staff profiles can be updated | E2E staff edit + contact visibility |
| C6 | Resources can be uploaded | E2E resource upload + new version |
| C7 | Gallery albums can be managed | E2E album + bulk upload + reorder |
| C8 | Contact enquiries can be reviewed | E2E enquiries inbox status/assign/note |
| C9 | Admissions can be processed | E2E status change → history → email queued |
| C10 | Permissions are enforced | pgTAP 20–24 + integration action matrix (FORBIDDEN per role) + E2E sidebar per role |
| C11 | Routine tasks do not require developer intervention | Usability sessions U1–U4 below + "no code to onboard" provisioning test (§7) |
| A1 | Applications can be submitted successfully | E2E admissions journey at 360 px |
| A2 | Required fields are validated | unit `buildApplicationSchema`; E2E error summary; pgTAP 40 |
| A3 | Supporting documents are handled securely | pgTAP 43/44; E2E signed URL expiry; upload validation unit tests |
| A4 | Applications are stored correctly | integration: payload ↔ row/answers/medical split; reference format |
| A5 | Administrators can review and update applications | E2E review + status + notes + info request |
| A6 | Applicants receive appropriate acknowledgement | integration: email queued with reference; Resend webhook status |
| A7 | Application reports can be generated | integration `admissions_report`; E2E reports page + CSV |
| T1 | Production database is correctly configured | provisioning smoke + Supabase Advisors zero errors |
| T2 | Authentication works | C1 + invite/reset E2E |
| T3 | RLS policies are tested | the pgTAP suite in CI (report attached) |
| T4 | Sensitive files are protected | A3 + anon storage tests |
| T5 | Backups are configured | restore drill record (`docs/runbooks/backup-restore.md`, Phase 15) |
| T6 | Error handling is implemented | unit error mapper; E2E error/not-found/forbidden pages; no stack traces |
| T7 | Critical workflows have automated tests | CI report: PRD §13.2 E2E list covered |
| T8 | Deployment documentation exists | `docs/runbooks/new-school.md` + §7.5 checklist |

**Usability (PRD §13.2)**: these are moderated sessions with real school staff, each to be completed unaided in under 5 minutes (MP §11):
- **U1** A non-technical administrator publishes an announcement.
- **U2** An admissions officer finds and processes an application.
- **U3** A visitor submits an enquiry on a smartphone.
- **U4** A school administrator changes a homepage image.

---

## 9. Open questions for Altrastate

From MP §15 (required):

| # | Question | Why it matters | Proposed default if unanswered |
|---|---|---|---|
| Q1 | Vercel and Supabase **plan tier** per school? | 5-min crons, BotID Deep Analysis, WAF rate limits, PITR, Advisors API | Vercel Pro + Supabase Pro; Turnstile fallback ready |
| Q2 | Who **owns** each school's Vercel/Supabase accounts (managed vs handover)? | provisioning tokens, credential transfer, fleet upgrades | Altrastate-managed org with the school as a billing contact |
| Q3 | Is the **medical section** needed for any launch school? | DPPA s.9 special-data review before enabling | Off; can't be enabled until a review is recorded (settings flag + ADR) |
| Q4 | **Approval workflow** default on or off? And when on, is `publish` alone ever enough, or is `approve` always required (§2.3 [DEV])? | lifecycle guard | Off; when on, `approve` gates publishing |
| Q5 | Default **retention periods** (unsuccessful applications, enquiries)? | the retention cron does nothing while null | No default; the dashboard warns until set |
| Q6 | **Luganda** / other languages in v1? | i18n architecture (message catalogues, `lang` attrs, content translation tables) | English only; UI strings still go through a `t()` catalogue so adding languages later is cheap |
| Q7 | **SMS** at launch (Africa's Talking)? | notification abstraction | Email only; `notify()` interface with an email adapter, SMS adapter stub |
| Q8 | **Template mockups** from Altrastate designers, or Claude-generated originals? | Phase 3 scope and review loop | Claude generates originals; review in a design checkpoint before Phase 3 sign-off |

Raised by this spec:

| # | Question |
|---|---|
| Q9 | Should admissions officers be able to enter **paper applications** (`admissions.create`)? Common in Uganda; it affects reporting. |
| Q10 | Should content editors be restricted to editing **their own** items? |
| Q11 | Are **enquiry attachments** (`private-attachments` bucket) needed in v1? MP lists the bucket but §5.7 has no attachment field. Proposed: not in v1. |
| Q12 | Approve **D13** (privileged auth calls through a job + internal webhook route), or allow a single named exception to the `admin.ts` rule? |
| Q13 | **Antivirus scanning** of uploaded documents (e.g. a ClamAV service)? Magic-byte + PDF heuristics are v1; AV needs hosting outside Vercel. |
| Q14 | May enquiry/admissions **alert emails include the message content**? Shared school inboxes argue no (current default: link only). |
| Q15 | Accept a **150 KB JS budget** on the admissions form route only? |
| Q16 | Should staff **reply to enquiries from the admin** (sent through Resend, threaded), or is `mailto:` acceptable for v1? |
| Q17 | Is `attribution.showAltrastateCredit` editable by the school, or only by platform_support? |
| Q18 | Payment of application fees is out of scope. Should the form show an informational "application fee" text block with instructions (e.g. Mobile Money paybill)? |
| Q19 | Reference format: is the year the **submission** year or the **intake's academic** year? Spec assumes submission year. |
| Q20 | ~~Roles and statuses~~ **Resolved from PRD §7 / §5.1** (§2.1, §1.10). Remaining question: is the Content Editor's scope right? It includes the gallery and excludes academics and staff. |
| Q21 | Supabase region: OK to run the latency probe from a Kampala vantage point (MTN/Airtel 4G) before choosing Frankfurt vs Ireland vs London? |
| Q22 | DSR "erase": anonymise (keep the statistics row) vs hard delete. Spec assumes anonymise; does the school's lawyer agree? |
| Q23 | PRD §5.6 says "upload **or** embed videos"; MP §5.5 makes them embed-only (YouTube/Vimeo), to save storage, bandwidth and school data bundles. Is embed-only acceptable? The fallback is direct MP4 upload ≤ 50 MB with a poster, which needs Supabase Pro storage. |
| Q24 | Media-library documents (PRD §6.5): should anything other than PDF be allowed there, given the resource centre already handles office documents? |
| Q25 | PRD §12.1 "important school announcements where configured" by email: is a parent mailing list (opt-in, unsubscribe, consent records) in v1 scope? Proposed: v2. |

---

## 10. ADRs to be written & phase mapping

| ADR | Title | Phase |
|---|---|---|
| 000 | Stack & versions (Next 16.x patched, React 19.2.x, Supabase new keys) | 1 |
| 001 | Threat model | 1 |
| 002 | Single-tenant-per-school deployment model | 1 |
| 003 | Submission tickets for public RPCs (D5) | 2 |
| 004 | Public document uploads via slot-gated anon storage policies (D6) | 2 |
| 005 | Autosave to a working copy (D4) & optimistic concurrency (D3) | 4 |
| 006 | Email queue + cron dispatch (D8) | 2/14 |
| 007 | Privileged auth admin operations (D13) | 2 |
| 008 | Rate limiting strategy (D9) | 2 |
| 009 | No recurring events in v1 | 8 |
| 010 | Staff contact visibility via materialised public columns | 10 |
| 011 | Admissions form versioning | 12 |
| 012 | Reference number algorithm (Feistel + Crockford + Luhn mod 32) | 12a |
| 013 | Admissions route JS budget exception (pending Q15) | 12c |
| 014 | PRD §9.3 entity naming → spec table names | 2 |

Phase plan: as MP §12. Phase 2 implements §1 to §3 for the core and RBAC tables. Each module phase adds its tables, policies and tests from this spec as its own migration (forward-only, expand → contract).

---

*End of spec. Next step: your review. Approve, or annotate the sections or questions to change. Phase 1 starts only after approval.*
