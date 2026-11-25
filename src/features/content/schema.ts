import { z } from '@/lib/zod';

/** Inputs shared by every content module's actions (spec §4.1). Client-safe. */

export const Version = z.number().int().positive();
export const ItemRef = z.object({ id: z.uuid() });
export const VersionedRef = z.object({ id: z.uuid(), version: Version });

/** A future instant with an explicit offset (the editor converts the school's local time). */
export const PublishAt = z.iso.datetime({ offset: true });

export const SendBackNote = z
  .string()
  .trim()
  .min(1, 'Say what needs changing.')
  .max(500, 'Keep the note under 500 characters.');

/** Typing the item's title confirms a permanent delete (spec §4.1 purge). */
export const PurgeInput = z.object({ id: z.uuid(), confirmTitle: z.string().max(200) });

/** Another person with unsaved changes to the same item (P4-D). */
export interface OtherEditor {
  name: string;
  updatedAt: string;
}

export interface ReviewNote {
  note: string;
  author: string;
  createdAt: string;
}
