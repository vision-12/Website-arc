# ADR-015 — Public forms without JavaScript (Q26)

- **Status:** **Accepted** (24 Nov 2026). Altrastate chose option 1.
- **Context:** open question Q26; ADR-000 amendment, items 3 and 8; spec §4.5 (`contact.submit`), §4.6 and §5.3 (admissions form), D5 (submission tickets), Q1 (BotID / Turnstile), Q9 (paper applications); MP §1 (primary device: mid-range Android on 3G/4G).

## Context

Phase 2 found that on a partially prerendered page, a form posted **before React hydrates** gets back only the page's dynamic parts, which leaves a blank page. Admin and sign-in forms therefore keep their submit button disabled until the page is ready. So with JavaScript off, those forms can't be used at all.

The public site has two forms:

- The **contact form** (Phase 11) is short. The contact page around it already shows the school's phone, email and address.
- The **admissions form** (Phase 12) has several steps and uploads documents straight to Storage. It resumes from local storage and validates with React Hook Form. None of this works without JavaScript.

Public submissions are protected in layers (spec §4.5, D5, ADR-008): BotID (Turnstile as fallback), a honeypot field, a minimum time on the page, a server-minted submission ticket, and per-IP and per-email rate limits. **BotID and Turnstile both run in the browser.** A request sent without JavaScript can't pass them.

## Options

1. **JavaScript required for both forms (recommended).**
   - Each form shows a `<noscript>` notice instead of a dead form. The contact form's notice points to the school's phone and email, which are on the page anyway.
   - The admissions notice explains that applying online needs JavaScript and gives the school's contact details for a paper application (Q9).
   - Every protection layer stays effective.
   - On 3G, the submit button is disabled for the few seconds before hydration, which is less than the time it takes to fill in a form (and the minimum time on the page is 3 s anyway).
2. **Contact form works without JavaScript; admissions needs it.**
   - The contact form posts to a small route handler, which answers with a redirect to a thank-you page (post/redirect/get). That avoids the blank-page problem, and it works before hydration too.
   - **Cost:** that path can't run BotID or Turnstile, so bots would use it to skip the bot check. Only the honeypot, the time check and the rate limits would stop them.
   - It also needs its own same-origin check, and its own way to show errors without JavaScript.

## Decision

**Option 1: both public forms require JavaScript.** Option 2 would help visitors whose browsers run no JavaScript at all, but they can already phone or email from the same page. In exchange it would have opened a bot path into the school's enquiry inbox. Mid-range Android phones, the primary device (MP §1), run JavaScript.

## Consequences

- Phase 11 and Phase 12 forms follow the admin pattern:
  - submit disabled until hydration
  - browser-side checks with the action's own schema
  - the Server Action as the form's `action` (ADR-000, items 3 and 8)
- Each public form page includes a `<noscript>` notice built from `site_settings` (no school-specific text in code).
- E2E: with JavaScript disabled, the contact and admissions pages show the notice and the school's contact details, and the pages are axe-clean.
