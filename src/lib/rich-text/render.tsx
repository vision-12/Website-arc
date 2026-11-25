import 'server-only';
import type { ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import { richTextExtensions } from './extensions';
import { isExternalHref, safeHref } from './safe-href';
import { TiptapDoc } from './schema';

/**
 * Server-side rendering of stored rich text (CLAUDE.md: store JSON, render with the static
 * renderer, never dangerouslySetInnerHTML). Returns null for missing or malformed documents, so a
 * bad value hides one block instead of breaking the page.
 */
export function renderRichText(doc: unknown): ReactNode {
  const parsed = TiptapDoc.safeParse(doc);
  if (!parsed.success) return null;
  try {
    return renderToReactElement({
      // Top-level shape checked above; node content is checked against the editor schema here (throws → null).
      content: parsed.data as JSONContent,
      extensions: richTextExtensions,
      options: {
        markMapping: {
          link: ({ mark, children }) => {
            const href = safeHref((mark.attrs as { href?: unknown }).href);
            if (!href) return <>{children}</>;
            // Same tab, by design: new tabs disorient screen-reader and mobile users.
            return isExternalHref(href) ? (
              <a href={href} rel="noopener noreferrer">
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
