# ADR-018 — Media uploads: direct to Storage, checked by the server

- **Status:** **Accepted** (26 Nov 2026). Phase 4 plan approved with P4-C and P4-G as recommended.
- **Context:** MP §5.9 (media library), §7.4 (storage), §11 (uploads on a school's data bundle), CLAUDE.md (no file bytes through a Function; private buckets), spec §3.9 and §4.2, open questions Q13 (antivirus) and Q24 (documents).

## Decision

### The path of a file

1. **On the device.** iPhone HEIC photos are converted to JPEG and large photos are shrunk to a 2,560 px long edge (`browser-image-compression`, `heic-to/csp`). Both libraries load only when a file needs them. The browser checks type and size with the same rules as the server and explains problems in plain words ("This file is 18 MB. The limit is 10 MB. Try a smaller photo.").
2. **`requestMediaUpload`** (`media.create`) creates an **unconfirmed** `media_assets` row and a signed upload URL for `media/{assetId}/{random}.{ext}`. Paths never contain names (MP §7.4).
3. **The browser uploads straight to Storage** with real progress (XHR). The bytes never pass through a Vercel Function.
4. **`confirmMediaUpload`** downloads the stored object and checks it:
   - the real type comes from the first bytes (`file-type`), never the name or the declared type;
   - photos are re-encoded with `sharp`: rotated upright, shrunk if still too large, **all metadata removed (EXIF, including GPS)**, and stored at a **new** path, so a cached copy can never show other bytes;
   - a 16 px blurred placeholder is stored with the row;
   - PDFs are refused if they contain scripts, attachments, forms or launch actions (the Q13 heuristics; no antivirus in v1).
     A rejected file is deleted and the person is told why.
5. **Only then is the row confirmed.** Unconfirmed rows are invisible to visitors (RLS) and hidden in the library. `housekeeping()` drops rows unconfirmed after an hour, and `/api/cron/housekeeping` removes files no row points at.

**Replace in place** follows the same steps, then points the existing row (same id) at the new file and removes the old one. Every page that uses it shows the new file.

### Rules held by the database

- An end user can't create a confirmed row; only the confirm step confirms it, once.
- Someone who may upload but not edit the library (`media.create` only) can still finish their own upload.
- An image can't be used without a description, can't lose its description while in use, and can't be trashed while in use (ADR-005).
- The `media` bucket accepts JPEG, PNG, WebP, AVIF, GIF and PDF.

### Not in v1

- **SVG is refused.** Safe SVG needs a sanitiser (DOMPurify on jsdom) on the server. Logos are the only real need, so Phase 5 decides with the logo upload.
- **No blurhash.** The stored placeholder does the same job.
- **Office documents** stay in the resource centre (Q24).

## Consequences

- **CSP:** HEIC conversion runs WebAssembly, so admin routes (only) add `'wasm-unsafe-eval'` to `script-src`. It allows compiling WebAssembly, not `eval()` of strings. Public routes are unchanged.
- **Function work:** the confirm step reads the stored file (up to 20 MB) inside a Server Action. That is a Storage read, not a request body, so the 4.5 MB request limit doesn't apply.
- **Data use:** a 12-megapixel phone photo (about 4 MB) is usually sent as about 1 MB.
- Visitors can read a public file's size (`size_bytes`), so PDF links can say "(PDF, 240 KB)". Who uploaded a file and its original name stay private.
