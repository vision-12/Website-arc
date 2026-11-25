# Progress

| Phase | Status | Notes |
|---|---|---|
| 0 — Technical spec | **Approved 23 Nov 2026**; open questions on provisional defaults (`00-decisions.md`) | |
| 1 — Foundation & design system | **Done**, merged (PR #1) | P1-A resolved better than planned: nonce CSP **and** prerendered shells (ADR-000). Evidence in `evidence/phase-01/` |
| 2 — Database, auth, RBAC & security | **Done**, merged (PR #4) | Plan approved (P2-A … P2-E). 15 migrations; pgTAP 132 assertions (red → green, mutation-checked); invite-only sign-in with TOTP MFA; audited privileged-auth jobs. DoD and plan changes: `phase-02.md` §10. Evidence in `evidence/phase-02/` |
| 3 — Public shell & template engine | **Done**, in review (PR #5) | Plan approved (P3-A … P3-G); design checkpoint approved (Q8). Four templates, preview links, demo gallery; switching proven to change only `theme.template` (checksum test). Open: Q27 (JavaScript budget vs framework floor). ADR-016. Evidence in `evidence/phase-03/`; outcome in `phase-03.md` §11 |
