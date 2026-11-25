'use server';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { updateTag } from 'next/cache';
import { defineAction } from '@/lib/actions/define';
import { ActionFailure } from '@/lib/actions/errors';
import { logActivity } from '@/lib/audit/log';
import { CacheTags } from '@/lib/cache/tags';
import { createClient, type TypedClient } from '@/lib/supabase/server';
import { ItemRef, PurgeInput, VersionedRef } from '@/features/content/schema';
import { inspectUpload, type Inspected } from './processing';
import { getMediaUsages, listMedia, MEDIA_COLUMNS, toMediaItem } from './queries';
import {
  ConfirmReplaceInput,
  ConfirmUploadInput,
  DOCUMENT_MAX_BYTES,
  EXTENSION,
  kindOf,
  MediaListInput,
  PHOTO_MAX_BYTES,
  RequestReplaceInput,
  RequestUploadInput,
  UpdateMediaInput,
  UPLOAD_TYPES,
  type UploadType,
} from './schema';

/**
 * Media library actions (spec §4.2). Bytes go browser → Storage through a signed upload URL; the
 * server then checks the stored file (ADR-018). Photos are re-encoded to a fresh path, so cached
 * copies never show stale bytes; PDFs are kept as uploaded once checked.
 */

const BUCKET = 'media';
const IMMUTABLE = '31536000';

/** Filenames are shown in the admin only, never used in paths (MP §7.4). */
const cleanFilename = (name: string) =>
  name
    .replace(/[\\/]/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .slice(0, 200) || 'file';

function mimeFromPath(path: string): UploadType {
  const ext = path.split('.').pop();
  const mime = UPLOAD_TYPES.find((t) => EXTENSION[t] === ext);
  if (!mime) throw new ActionFailure('UPLOAD_REJECTED');
  return mime;
}

/** Downloads the uploaded object and runs the server check on it. */
async function checkStoredFile(
  supabase: TypedClient,
  path: string,
  declared: UploadType,
): Promise<Inspected> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error)
    throw new ActionFailure(
      'UPLOAD_REJECTED',
      'The upload didn’t arrive. Check your connection and try again.',
    );
  const bytes = new Uint8Array(await data.arrayBuffer());
  const limit = kindOf(declared) === 'document' ? DOCUMENT_MAX_BYTES : PHOTO_MAX_BYTES;
  if (bytes.length > limit)
    return { ok: false, reason: 'This file is larger than the limit. Try a smaller one.' };
  return inspectUpload(bytes, declared);
}

/** Stores a re-encoded photo at a new path; documents keep their checked upload. */
async function storeChecked(
  supabase: TypedClient,
  assetId: string,
  uploadedPath: string,
  file: Inspected & { ok: true },
) {
  if (file.kind === 'document') return { path: uploadedPath, size: file.bytes.length };
  const path = `${assetId}/${randomUUID()}.${file.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: file.mime, cacheControl: IMMUTABLE, upsert: false });
  if (error) throw error;
  // Best effort: the hourly housekeeping job removes any file a media row no longer points at.
  await supabase.storage.from(BUCKET).remove([uploadedPath]);
  return { path, size: file.bytes.length };
}

function expireMediaTags(id: string) {
  updateTag(CacheTags.media(id));
  // Page text resolves photos when rendered; homepage sections are tagged per media id.
  updateTag(CacheTags.pages);
}

/** Step 1 of an upload: a library row (unconfirmed) and a signed URL the browser uploads to. */
export const requestMediaUpload = defineAction({
  input: RequestUploadInput,
  permission: 'media.create',
  handler: async ({ filename, mime, size }, { access }) => {
    const supabase = await createClient();
    const id = randomUUID();
    const path = `${id}/${randomUUID()}.${EXTENSION[mime]}`;
    const { error } = await supabase.from('media_assets').insert({
      id,
      kind: kindOf(mime),
      bucket: BUCKET,
      path,
      original_filename: cleanFilename(filename),
      mime_type: mime,
      size_bytes: size,
      uploaded_by: access.userId,
    });
    if (error) throw error;
    const { data, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (urlError) throw urlError;
    return { assetId: id, signedUrl: data.signedUrl };
  },
});

/** Step 2: the server checks the stored file and adds it to the library. */
export const confirmMediaUpload = defineAction({
  input: ConfirmUploadInput,
  permission: 'media.create',
  handler: async ({ assetId }, { access }) => {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('media_assets')
      .select(`${MEDIA_COLUMNS}, confirmed_at, uploaded_by`)
      .eq('id', assetId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new ActionFailure('NOT_FOUND');
    if (row.confirmed_at) return toMediaItem(row);
    if (row.uploaded_by !== access.userId) throw new ActionFailure('FORBIDDEN');

    const file = await checkStoredFile(supabase, row.path, mimeFromPath(row.path));
    if (!file.ok) {
      await supabase.storage.from(BUCKET).remove([row.path]);
      throw new ActionFailure('UPLOAD_REJECTED', file.reason);
    }
    const stored = await storeChecked(supabase, row.id, row.path, file);
    const { data: saved, error: saveError } = await supabase
      .from('media_assets')
      .update({
        path: stored.path,
        mime_type: file.mime,
        size_bytes: stored.size,
        ...(file.kind === 'image'
          ? { width: file.width, height: file.height, lqip: file.lqip }
          : {}),
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .select(MEDIA_COLUMNS)
      .single();
    if (saveError) throw saveError;
    await logActivity(supabase, {
      action: 'media.upload',
      entityType: 'media',
      entityId: saved.id,
      summary: `Uploaded "${saved.original_filename ?? 'a file'}" to the media library`,
      metadata: { kind: saved.kind, sizeBytes: saved.size_bytes },
    });
    return toMediaItem(saved);
  },
});

/** Description (alt text) and caption. An in-use photo can't lose its description (DB check). */
export const updateMedia = defineAction({
  input: UpdateMediaInput,
  permission: 'media.edit',
  handler: async ({ id, version, altText, caption }) => {
    const supabase = await createClient();
    const { data: before } = await supabase
      .from('media_assets')
      .select('alt_text, caption, original_filename')
      .eq('id', id)
      .maybeSingle();
    const { data, error } = await supabase
      .from('media_assets')
      .update({ alt_text: altText || null, caption: caption || null })
      .eq('id', id)
      .eq('version', version)
      .is('deleted_at', null)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionFailure(before ? 'CONFLICT' : 'NOT_FOUND');
    await logActivity(supabase, {
      action: 'media.update',
      entityType: 'media',
      entityId: id,
      summary: `Updated the description of "${data.original_filename ?? 'a file'}"`,
      before: { alt_text: before?.alt_text ?? null, caption: before?.caption ?? null },
      after: { alt_text: data.alt_text, caption: data.caption },
    });
    expireMediaTags(id);
    return toMediaItem(data);
  },
});

/** Replace in place, step 1: a signed URL for the new file (the item keeps its id, MP §5.9). */
export const requestMediaReplace = defineAction({
  input: RequestReplaceInput,
  permission: 'media.edit',
  handler: async ({ id, mime }) => {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('media_assets')
      .select('kind, deleted_at')
      .eq('id', id)
      .maybeSingle();
    if (!row || row.deleted_at) throw new ActionFailure('NOT_FOUND');
    if (row.kind !== kindOf(mime))
      throw new ActionFailure(
        'VALIDATION',
        'Replace a photo with another photo, or a PDF with another PDF.',
      );
    const path = `${id}/${randomUUID()}.${EXTENSION[mime]}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return { path, signedUrl: data.signedUrl };
  },
});

/** Replace in place, step 2: check the new file and point the item at it. */
export const confirmMediaReplace = defineAction({
  input: ConfirmReplaceInput,
  permission: 'media.edit',
  handler: async ({ id, version, path, filename }) => {
    if (!path.startsWith(`${id}/`)) throw new ActionFailure('VALIDATION');
    const supabase = await createClient();
    const { data: before } = await supabase
      .from('media_assets')
      .select(MEDIA_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (!before || before.deleted_at) throw new ActionFailure('NOT_FOUND');
    if (before.version !== version) throw new ActionFailure('CONFLICT');

    const file = await checkStoredFile(supabase, path, mimeFromPath(path));
    if (!file.ok) throw new ActionFailure('UPLOAD_REJECTED', file.reason);
    if (file.kind !== before.kind)
      throw new ActionFailure(
        'VALIDATION',
        'Replace a photo with another photo, or a PDF with another PDF.',
      );
    const stored = await storeChecked(supabase, id, path, file);
    const { data: saved, error } = await supabase
      .from('media_assets')
      .update({
        path: stored.path,
        mime_type: file.mime,
        size_bytes: stored.size,
        original_filename: cleanFilename(filename),
        replaced_at: new Date().toISOString(),
        ...(file.kind === 'image'
          ? { width: file.width, height: file.height, lqip: file.lqip }
          : {}),
      })
      .eq('id', id)
      .eq('version', version)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!saved) throw new ActionFailure('CONFLICT');
    await supabase.storage.from(BUCKET).remove([before.path]);
    await logActivity(supabase, {
      action: 'media.replace',
      entityType: 'media',
      entityId: id,
      summary: `Replaced "${before.original_filename ?? 'a file'}" with "${saved.original_filename ?? 'a new file'}"`,
    });
    expireMediaTags(id);
    return toMediaItem(saved);
  },
});

export const trashMedia = defineAction({
  input: VersionedRef,
  permission: 'media.delete',
  handler: async ({ id, version }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('version', version)
      .is('deleted_at', null)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (error) throw error; // MEDIA_IN_USE from the database: "Replace it instead of deleting it."
    if (!data) throw new ActionFailure('CONFLICT');
    await logActivity(supabase, {
      action: 'media.trash',
      entityType: 'media',
      entityId: id,
      summary: `Moved "${data.original_filename ?? 'a file'}" to Trash`,
    });
    expireMediaTags(id);
    return toMediaItem(data);
  },
});

export const restoreMedia = defineAction({
  input: ItemRef,
  permission: 'media.delete',
  handler: async ({ id }) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('media_assets')
      .update({ deleted_at: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select(MEDIA_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ActionFailure('NOT_FOUND');
    await logActivity(supabase, {
      action: 'media.restore',
      entityType: 'media',
      entityId: id,
      summary: `Restored "${data.original_filename ?? 'a file'}" from Trash`,
    });
    expireMediaTags(id);
    return toMediaItem(data);
  },
});

/** Permanent delete from Trash: the person types the file name to confirm. */
export const purgeMedia = defineAction({
  input: PurgeInput,
  permission: 'trash.purge',
  handler: async ({ id, confirmTitle }) => {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('media_assets')
      .select(MEDIA_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (!row) throw new ActionFailure('NOT_FOUND');
    if (!row.deleted_at)
      throw new ActionFailure('VALIDATION', 'Only items in Trash can be deleted permanently.');
    const name = row.original_filename ?? '';
    if (confirmTitle.trim().toLowerCase() !== name.trim().toLowerCase())
      throw new ActionFailure('VALIDATION', 'Type the file name exactly as shown to confirm.', {
        confirmTitle: ['Type the file name exactly as shown to confirm.'],
      });
    const { error } = await supabase.from('media_assets').delete().eq('id', id);
    if (error) throw error;
    await supabase.storage.from(BUCKET).remove([row.path]);
    await logActivity(supabase, {
      action: 'media.purge',
      entityType: 'media',
      entityId: id,
      summary: `Permanently deleted "${name || 'a file'}"`,
    });
    return { id };
  },
});

/** The library and the picker page through results with this. */
export const searchMedia = defineAction({
  input: MediaListInput,
  permission: 'media.view',
  handler: (input) => listMedia(input),
});

/** "Used in" for the details panel. */
export const mediaUsages = defineAction({
  input: ItemRef,
  permission: 'media.view',
  handler: async ({ id }) => getMediaUsages(await createClient(), id),
});
