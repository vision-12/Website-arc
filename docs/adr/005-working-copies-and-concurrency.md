# ADR-005 — Autosave to per-person working copies; optimistic concurrency

- **Status:** **Accepted** (26 Nov 2026). Phase 4 plan approved with P4-D, P4-E and P4-F as recommended.
- **Context:** MP §5 (shared content lifecycle: autosave, optimistic concurrency), MP §11 (save states), spec D3 and D4, spec §1.3 (`content_drafts`, `media_usages`), `docs/plan/phase-04.md` §3–§5.

## Context

Three requirements pull in different directions:

1. **Autosave every 10 seconds** (MP §11). Editors on intermittent connections must not lose what they type.
2. **Nothing half-typed goes public.** Writing autosaves into the live row would publish unfinished edits on a published page.
3. **Two people never overwrite each other** (MP §5): a stale save gets "Someone else edited this — reload to see their changes."

The spec (D4) already sends autosaves to a working copy (`content_drafts`), but with **one copy per item**. When two people edit the same page, their autosaves then overwrite each other's unsaved text, which is the very thing requirement 3 forbids.

## Decision

### Working copies are per person (P4-D)

- `content_drafts` is keyed by `(entity_type, entity_id, updated_by)`. RLS lets a person read, write and delete **only their own** copy, and only with `<module>.edit`.
- `save_working_copy()` (security invoker) upserts the caller's copy at most once every 5 seconds. "Preview" forces a save so the preview shows what was just typed.
- `content_editors()` (security definer) tells the editor who else has unsaved changes and when, **never their text**. The editor shows "Sarah Namu is also editing this page" for copies changed in the last two minutes.
- "Save draft", "Publish to website" and the other explicit actions **apply** the person's values to the item in one version-checked update, then delete their copy.
- A status-only change (hide, cancel schedule, send back, Trash) moves the person's copy to the new version: it is still based on the same text.

### Optimistic concurrency (D3)

- Every write sends the `version` it started from and runs `update … where id = $1 and version = $2`. The lifecycle trigger bumps `version` on every update. Zero rows means `CONFLICT`.
- **On a conflict the person's text is kept**: the action stores it as their working copy (based on the old version) before returning the error. After reloading, the editor offers "You have unsaved changes from before someone else changed this page: Show my changes / Discard them". Showing them makes the person's version current, so publishing it is a conscious choice.
- Autosave and a 30-second poll also report when someone else has saved since the editor opened, so the warning comes before the person tries to publish.

### "Used in" lives in the database (P4-E)

`media_usages` is rebuilt by a trigger on the content table, in the same statement as the save: image nodes and PDF links in the body, the cover photo and the SEO image. Consequences:

- The existing `ALT_TEXT_REQUIRED` check stops any save or publish that contains an undescribed photo, whatever the client sends.
- An in-use photo can't be moved to Trash (`MEDIA_IN_USE`) or lose its description.
- No action can forget to update usages, because no action does it.

### Rich text stores media by id (P4-F)

The `image` node stores only `{ mediaId, size }`; PDF links carry `mediaId` on the link mark. The file, description and caption are looked up when the page is rendered. A corrected description or a replaced file (same id) updates every page at once, and no URL or base64 data is ever stored in rich text.

## Consequences

- Each content module (news, events, …) reuses the same content service (`src/features/content/service.ts`): it supplies a small typed table adapter and gets working copies, conflicts, status changes, Trash and audit.
- A copy whose base version is older than the item is **stale**: it is shown as an offer, never applied silently.
- Reordering or moving pages changes their version too, so someone editing one of them meanwhile gets the conflict message. That is rare and safe: their text is kept.
- The editor sends rich text as a plain JSON copy: ProseMirror builds node attributes as null-prototype objects, which Server Actions drop.

## Alternatives considered

- **One working copy per item (spec D4 as written).** Rejected: two people's autosaves overwrite each other.
- **Locking a page while someone edits it.** Rejected: abandoned locks on shared desktops and tablets block colleagues; it also needs a lock-breaking UI.
- **Real-time co-editing (CRDT).** Out of scope for v1; far more machinery than schools need.
