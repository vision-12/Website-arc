# Phase 0 — Spec approval & provisional decisions

**Spec approved:** 23 Nov 2026 (`docs/plan/00-technical-spec.md`, reconciled with PRD v1.0).

The open questions in spec §9 were not individually answered. Each one therefore adopts the **proposed default** written in the spec, *provisionally*. A provisional default can be overturned at any time before the phase listed in "Must be confirmed before". Every default that touches admissions, retention or privacy becomes an ADR when its phase starts (CLAUDE.md workflow rule 5).

| Q | Provisional decision | Must be confirmed before |
|---|---|---|
| Q1 plan tiers | Vercel Pro + Supabase Pro; Turnstile fallback kept ready | Phase 14 |
| Q2 account ownership | Altrastate-managed orgs; school = billing contact | Phase 15 |
| Q3 medical section | Off; cannot be enabled until a DPPA s.9 review is recorded | Phase 12 |
| Q4 approval workflow | **Confirmed 25 Nov 2026 (Phase 4 plan, P4-A):** off by default. When a school turns it on, `approve` is required to publish, schedule, hide, archive or change a live item; `publish` alone is not enough. Review-request emails come with the email dispatcher (Phase 11); a dashboard tile covers it until then | Confirmed |
| Q5 retention periods | **No default** — retention cron is a no-op and the dashboard warns until set | Phase 13 |
| Q6 languages | English only; UI strings go through a `t()` catalogue from Phase 1 | Phase 1 (adopted) |
| Q7 SMS | Email only; `notify()` abstraction with an email adapter | Phase 12 |
| Q8 template designs | **Decided 25 Nov 2026:** four original designs approved at the Phase 3 design checkpoint (ADR-016) | Confirmed |
| Q9 paper applications | Included (`admissions.create`) | Phase 12 |
| Q10 own-items-only editing | **Confirmed 25 Nov 2026 (P4-B):** no restriction. Anyone with `M.edit` edits any item; accountability comes from "Last edited by" and the audit log | Confirmed |
| Q11 enquiry attachments | Not in v1 | Phase 11 |
| Q12 privileged auth calls | D13 (audited job + internal webhook route) | Phase 2 |
| Q13 antivirus scanning | Not in v1; magic-byte + PDF heuristics only | Phase 12 |
| Q14 PII in alert emails | Link only, no message content | Phase 11 |
| Q15 admissions JS budget | 150 KB on the admissions form route only | Phase 12 |
| Q16 replying to enquiries | `mailto:` in v1 | Phase 11 |
| Q17 Altrastate credit toggle | Editable by `settings.manage` | Phase 5 |
| Q18 application-fee text | Optional rich-text block on the intake | Phase 12 |
| Q19 reference year | Submission year | Phase 12 |
| Q20 Content Editor scope | Pages, news, resources and gallery, per spec §2.5 | Phase 2 |
| Q21 region probe | Run the probe from Kampala before the first production school | Phase 15 |
| Q22 DSR erase | Anonymise and keep the statistics row; lawyer to confirm | Phase 13 |
| Q23 video | Embed-only | Phase 9 |
| Q24 media documents | **Confirmed 25 Nov 2026 (P4-C):** PDF only in the media library; office files stay in the resource centre (Phase 11) | Confirmed |
| Q25 announcement emails | v2 | — |
| Q26 public forms without JavaScript | **Decided 24 Nov 2026 (ADR-015):** JavaScript required for both public forms, with a `<noscript>` notice giving the school's phone and email (contact) or the paper route (admissions). A no-JS contact path was considered and not recommended: it can't run BotID or Turnstile, so bots would use it | Confirmed |
| Q27 first-load JavaScript budget | **Decided 25 Nov 2026 (ADR-017):** public routes load the framework runtime (Next.js 16 + React 19, 132 KB gzipped, measured) plus at most 20 KB gzipped of our own JavaScript (15 KB today). MP §10's 120 KB total can't be met with the stack MP §2 pins | Confirmed |

## Phase 4 decisions that change the spec

| ID | Decision | Replaces |
|---|---|---|
| P4-D | One autosave working copy **per person** (`content_drafts` key gains `updated_by`), plus an "also editing" notice. ADR-005 | Spec §1.3: one working copy per item |
| P4-E | `media_usages` is rebuilt by a database trigger in the same statement as the save | Spec §1.3: rebuilt by the app after each save |
| P4-F | Rich-text images store only the media id; the file and description are resolved at render time | — |
| P4-G | Uploads: SVG rejected until Phase 5 (logos); no blurhash (the blurred placeholder is enough). ADR-018 | Spec §4.2 SVG sanitisation, blurhash |
| P4-H | Redirects are looked up only when a page isn't found, not by `proxy.ts` on every request | Spec §1.3 (`redirects` read by `proxy.ts`) |
| P4-I | Scheduled publishing runs as a Vercel Schedule (or legacy cron if a Schedule can't send the bearer header) | Spec §4.8 `vercel.json` crons |
| P4-J | Pages are reordered with move buttons; drag-and-drop comes with Phase 5 | Spec §5.4 "drag to reorder/nest" (Phase 4 part) |
| P4-L | Trash is emptied automatically by the Phase 13 retention job; until then nothing is deleted without a person | — |
