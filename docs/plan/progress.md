# Progress

| Phase | Status | Notes |
|---|---|---|
| 0 — Technical spec | **Approved 23 Nov 2026**; open questions on provisional defaults (`00-decisions.md`) | |
| 1 — Foundation & design system | **Done**, merged (PR #1) | P1-A resolved better than planned: nonce CSP **and** prerendered shells (ADR-000). Evidence in `evidence/phase-01/` |
| 2 — Database, auth, RBAC & security | **Done**, awaiting review (branch `feat/phase-02-database`) | Plan approved (P2-A … P2-E). 15 migrations; pgTAP 132 assertions (red → green, mutation-checked); invite-only sign-in with TOTP MFA; audited privileged-auth jobs. DoD and plan changes: `phase-02.md` §10. Evidence in `evidence/phase-02/` |
