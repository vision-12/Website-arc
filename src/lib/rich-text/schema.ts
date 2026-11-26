import { z } from '@/lib/zod';

/**
 * A Tiptap JSON document as stored in the database. The renderer checks the structure against the
 * editor schema; this only bounds shape and size so malformed or oversized input never reaches it.
 * Client-safe: the Phase 4 editor and the Phase 5 homepage builder validate with it too.
 */
export const TiptapDoc = z
  .object({ type: z.literal('doc'), content: z.array(z.unknown()).max(200) })
  .refine((doc) => JSON.stringify(doc).length <= 50_000, 'This text is too long');

export type TiptapDoc = z.infer<typeof TiptapDoc>;
