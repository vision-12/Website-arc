# Phase 0 — Spec approval & provisional decisions

**Spec approved:** 23 Nov 2026 (`docs/plan/00-technical-spec.md`, reconciled with PRD v1.0).

The open questions in spec §9 were not individually answered. Each one therefore adopts the **proposed default** written in the spec, *provisionally*. A provisional default can be overturned at any time before the phase listed in "Must be confirmed before". Every default that touches admissions, retention or privacy becomes an ADR when its phase starts (CLAUDE.md workflow rule 5).

| Q | Provisional decision | Must be confirmed before |
|---|---|---|
| Q1 plan tiers | Vercel Pro + Supabase Pro; Turnstile fallback kept ready | Phase 14 |
| Q2 account ownership | Altrastate-managed orgs; school = billing contact | Phase 15 |
| Q3 medical section | Off; cannot be enabled until a DPPA s.9 review is recorded | Phase 12 |
| Q4 approval workflow | Off by default; when on, `approve` gates publishing | Phase 4 |
| Q5 retention periods | **No default** — retention cron is a no-op and the dashboard warns until set | Phase 13 |
| Q6 languages | English only; UI strings go through a `t()` catalogue from Phase 1 | Phase 1 (adopted) |
| Q7 SMS | Email only; `notify()` abstraction with an email adapter | Phase 12 |
| Q8 template designs | Claude generates original designs; design checkpoint before Phase 3 sign-off | Phase 3 |
| Q9 paper applications | Included (`admissions.create`) | Phase 12 |
| Q10 own-items-only editing | No restriction | Phase 4 |
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
| Q24 media documents | PDF only | Phase 4 |
| Q25 announcement emails | v2 | — |
| Q26 public forms without JavaScript | Proposed: JavaScript required — forms stay disabled until the page has loaded, because a pre-hydration submit returns a broken page (ADR-000 amendment, Phase 2). Alternative: a no-JS fallback page | Phase 11 |
