# ADR-001 — Threat model

- **Status:** Accepted (Phase 1, 23 Nov 2026). Revisit at each phase that adds a trust boundary (2, 4, 11, 12, 13, 14).
- **Scope:** one school installation: Next.js on Vercel plus one Supabase project. Fleet operations are covered by MP §13.

## Assets (in priority order, MP §7.1)

1. **Children's personal data and documents**: applications, birth certificates, school reports, medical answers (DPPA s.8/s.9 special data).
2. **Admin accounts**, especially super admins and admissions officers.
3. **School reputation**: defacement of the public site, false announcements.
4. **Email reputation**: the school's sending domain (spoofing, spam via our forms).
5. Enquiries (contact details of parents) and the audit log (integrity).

## Actors

| Actor                   | Trust                            | Access                                                  |
| ----------------------- | -------------------------------- | ------------------------------------------------------- |
| Public visitor / parent | untrusted                        | public pages; public forms through ticket-gated RPCs    |
| Bot / attacker          | hostile                          | same surface as visitors, at scale                      |
| School staff            | authenticated, partially trusted | RBAC permissions (spec §2), RLS-enforced                |
| Altrastate support      | authenticated, restricted        | no personal data without a time-boxed grant (spec §2.4) |
| Supply chain            | semi-trusted                     | npm packages, GitHub Actions, Vercel/Supabase/Resend    |

## Trust boundaries

```
Browser ──(1)──▶ Vercel edge/proxy.ts ──(2)──▶ Server Components / Actions ──(3)──▶ Supabase (PostgREST + RLS)
   │                                                                          ▲
   └──────────────(4) signed upload URL ─────────────▶ Supabase Storage ───────┘
Vercel Cron / Resend webhooks ──(5)──▶ app/api/cron|webhooks ──(secret key)──▶ Supabase
```

1. Untrusted input enters: headers, form bodies, uploads.
2. Server Actions re-validate everything with Zod and re-check permissions (`requirePermission`).
3. **RLS is the security boundary.** The app's filters are for performance only.
4. File bytes bypass our functions. Storage policies and upload slots (spec D6) are the gate.
5. Only these routes may hold the secret key (ESLint `no-restricted-imports`).

## Threats → mitigations → where → when tested

| #   | Threat (STRIDE)                               | Mitigation                                                                                                                                           | Spec / file                                             | Phase · test                                                                      |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| T1  | IDOR on applications/documents (I)            | RLS on every table; documents private; 60 s signed URLs after a permission check; random UUID paths; audit per download                              | spec §3.7, §3.9                                         | 2/12 · pgTAP 43–44, E2E IDOR                                                      |
| T2  | Broken or missing RLS (I, E)                  | CI asserts RLS is on for every table, `(select auth.uid())` initPlan form, `search_path=''` on definer functions; test-first policies                | spec §8.2 (00–03)                                       | 2 · pgTAP 00–03                                                                   |
| T3  | Privilege escalation via crafted requests (E) | single `has_permission()` path; escalation and last-super-admin triggers in SQL; UI hiding is cosmetic only                                          | spec §2.4, §3.5                                         | 2/13 · pgTAP 22                                                                   |
| T4  | Stored XSS via rich text (T, I)               | Tiptap JSON + static renderer with an allow-listed node set; `dangerouslySetInnerHTML` banned by lint; nonce CSP without `unsafe-inline` scripts     | ADR-000, `eslint.config.mjs`, `src/lib/security/csp.ts` | **1** (CSP + lint) · 4 (renderer) · unit `csp.test.ts`, E2E CSP-violation fixture |
| T5  | Spam/bot floods on public forms (D)           | BotID, honeypot, ≥ 3 s time-to-submit, WAF + Postgres rate limits, HMAC submission tickets so RPCs can't be called directly                          | spec D5, D9                                             | 11/12/14                                                                          |
| T6  | Credential stuffing (S)                       | invite-only; ≥ 12-char passwords + leaked-password check; rate-limited login with generic errors; optional/required TOTP (aal2 enforced in RLS)      | spec §4.7, §3                                           | 2                                                                                 |
| T7  | Malicious uploads (T, E)                      | magic-byte check, EXIF strip, PDF active-content rejection, MIME allow-lists on buckets, no uploads on the site origin                               | spec D6, §4.6                                           | 4/12                                                                              |
| T8  | Secret leakage (I)                            | Zod env split (`NEXT_PUBLIC_` values may never be `sb_secret_…`); secret key confined by lint; gitleaks pre-commit and CI; no PII or secrets in logs | `src/lib/env/schema.ts`, `.husky/pre-commit`, CI        | **1** · unit `schema.test.ts`                                                     |
| T9  | Supply-chain vulnerabilities (T, E)           | pinned versions + lockfile; `check:audit` fails on any React/Next advisory (React2Shell class) and any high/critical; Renovate weekly                | `scripts/check-audit.mjs`, `renovate.json`              | **1** · CI `security` job                                                         |
| T10 | Clickjacking / framing (T)                    | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (the preview route alone allows `'self'`, Phase 5)                                                | `next.config.ts`, CSP                                   | **1** · E2E header test                                                           |
| T11 | Defacement through admin takeover (T)         | as T3/T6; audit log of every publish; versioned content (optimistic concurrency)                                                                     | spec §1.11, D3                                          | 2/4/13                                                                            |
| T12 | Cached personal data leaking across users (I) | never `'use cache'` user data; admin `Cache-Control: private, no-store`; the cookie-less public client is the only one allowed in cache scopes       | spec D7, `src/proxy.ts`                                 | **1** (headers) · 2 (clients)                                                     |
| T13 | Email spoofing / abuse of our sender (S)      | SPF/DKIM/DMARC at provisioning; form emails never echo visitor content to third parties; suppression list                                            | spec §4.10, §7                                          | 11/14                                                                             |
| T14 | Exposure before auth exists (I)               | `/admin` returns 404 in production until Phase 2                                                                                                     | ADR-000 decision 3                                      | **1** · unit `proxy.test.ts`                                                      |
| T15 | Repudiation by staff (R)                      | append-only `activity_logs` (no UPDATE/DELETE policy + trigger), DB-sourced rows for sensitive changes                                               | spec §1.11                                              | 2/13 · pgTAP 31                                                                   |
| T16 | Data stored abroad (compliance)               | DPPA s.19 notice on forms; processors and regions in the privacy policy; PDPO registration on the go-live checklist                                  | MP §8                                                   | 11/12/15                                                                          |

## Residual risks (accepted for v1)

- No antivirus scanning of uploads (Q13). This is mitigated by type and structure checks and by never serving documents from the site origin.
- `'strict-dynamic'` is not used (ADR-000), so any same-origin script could execute. This is acceptable because the site origin never serves user content.
- Altrastate support staff can still see audit metadata, with values redacted.
