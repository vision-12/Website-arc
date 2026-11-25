import 'server-only';
import type { ReactNode } from 'react';
import Image from 'next/image';
import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import { formatFileSize } from '@/lib/format/file-size';
import { richTextExtensions } from './extensions';
import { isExternalHref, safeHref } from './safe-href';
import { TiptapDoc } from './schema';

/** A library photo, resolved for rendering (description and caption come from the library). */
export interface RichTextImage {
  src: string;
  width: number;
  height: number;
  alt: string;
  lqip?: string;
  caption?: string;
}

/** A library PDF, resolved for rendering. */
export interface RichTextDocument {
  url: string;
  sizeBytes: number;
}

export interface RichTextMedia {
  images: Record<string, RichTextImage>;
  documents: Record<string, RichTextDocument>;
}

const NO_MEDIA: RichTextMedia = { images: {}, documents: {} };

function Figure({ image, wide }: { image: RichTextImage; wide: boolean }) {
  return (
    <figure className={wide ? 'rt-figure rt-figure-wide' : 'rt-figure'}>
      <Image
        src={image.src}
        width={image.width}
        height={image.height}
        alt={image.alt}
        sizes={wide ? '(min-width: 1280px) 1200px, 100vw' : '(min-width: 768px) 720px, 100vw'}
        loading="lazy"
        {...(image.lqip ? { placeholder: 'blur' as const, blurDataURL: image.lqip } : {})}
      />
      {image.caption ? <figcaption>{image.caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Server-side rendering of stored rich text (CLAUDE.md: store JSON, render with the static
 * renderer, never dangerouslySetInnerHTML). Images and PDF links are drawn from `media`; anything
 * missing (deleted, unknown or not passed) is left out rather than shown broken. Returns null for
 * missing or malformed documents, so a bad value hides one block instead of breaking the page.
 */
export function renderRichText(doc: unknown, media: RichTextMedia = NO_MEDIA): ReactNode {
  const parsed = TiptapDoc.safeParse(doc);
  if (!parsed.success) return null;
  try {
    return renderToReactElement({
      // Top-level shape checked above; node content is checked against the editor schema here (throws → null).
      content: parsed.data as JSONContent,
      extensions: richTextExtensions,
      options: {
        nodeMapping: {
          image: ({ node }) => {
            const attrs = node.attrs as { mediaId?: unknown; size?: unknown };
            const image =
              typeof attrs.mediaId === 'string' ? media.images[attrs.mediaId] : undefined;
            return image ? <Figure image={image} wide={attrs.size === 'wide'} /> : null;
          },
        },
        markMapping: {
          link: ({ mark, children }) => {
            const attrs = mark.attrs as { href?: unknown; mediaId?: unknown };
            if (typeof attrs.mediaId === 'string') {
              const file = media.documents[attrs.mediaId];
              if (!file) return <>{children}</>;
              return (
                <a href={file.url}>
                  {children}{' '}
                  <span className="rt-file">(PDF, {formatFileSize(file.sizeBytes)})</span>
                </a>
              );
            }
            const href = safeHref(attrs.href);
            if (!href) return <>{children}</>;
            // Same tab, by design: new tabs disorient screen-reader and mobile users. Outside links
            // carry nofollow (MP §7.5).
            return isExternalHref(href) ? (
              <a href={href} rel="noopener noreferrer nofollow">
                {children}
              </a>
            ) : (
              <a href={href}>{children}</a>
            );
          },
        },
        unhandledNode: () => null,
        unhandledMark: ({ children }) => <>{children}</>,
      },
    });
  } catch {
    return null;
  }
}
