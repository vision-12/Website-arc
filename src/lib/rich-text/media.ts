/**
 * Media references inside a Tiptap document (plan P4-F). Image nodes and PDF links carry only a
 * media id; files and descriptions are resolved at render time. This mirrors the database's
 * `private.rich_text_media_ids()`, which records the same ids as "used in" (P4-E). Client-safe.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RichTextMediaIds {
  /** `image` nodes */
  images: string[];
  /** link marks pointing at a document in the media library */
  documents: string[];
}

interface Node {
  type?: unknown;
  attrs?: { mediaId?: unknown } | null;
  marks?: Array<{ type?: unknown; attrs?: { mediaId?: unknown } | null }>;
  content?: unknown;
}

export function richTextMediaIds(doc: unknown): RichTextMediaIds {
  const images = new Set<string>();
  const documents = new Set<string>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 50) return;
    const n = node as Node;
    const id = n.attrs?.mediaId;
    if (n.type === 'image' && typeof id === 'string' && UUID_RE.test(id)) images.add(id);
    for (const mark of n.marks ?? []) {
      const markId = mark.attrs?.mediaId;
      if (mark.type === 'link' && typeof markId === 'string' && UUID_RE.test(markId))
        documents.add(markId);
    }
    if (Array.isArray(n.content)) for (const child of n.content) visit(child, depth + 1);
  };
  visit(doc, 0);
  return { images: [...images], documents: [...documents] };
}
