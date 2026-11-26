import { mergeAttributes, Node } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { safeHref } from './safe-href';

/**
 * A photo from the media library (plan P4-F). The node stores only the media id and a size; the
 * file, its description and caption are looked up when the page is rendered, so a corrected
 * description or a replaced photo updates every page that uses it. Pasted <img> tags never match
 * (no hot-linked or base64 images, CLAUDE.md).
 */
export const MediaImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      mediaId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: { mediaId?: string | null }) =>
          attrs.mediaId ? { 'data-media-id': attrs.mediaId } : {},
      },
      size: {
        default: 'normal',
        parseHTML: (el) => (el.getAttribute('data-size') === 'wide' ? 'wide' : 'normal'),
        renderHTML: (attrs: { size?: string }) => ({ 'data-size': attrs.size ?? 'normal' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-media-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes)];
  },
});

/**
 * Links, plus an optional media id for a PDF from the media library: the address is resolved at
 * render time, so replacing the file keeps every link working. Unsafe protocols are refused while
 * typing (and again by the renderer).
 */
export const SchoolLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: { mediaId?: string | null }) =>
          attrs.mediaId ? { 'data-media-id': attrs.mediaId } : {},
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: 'https',
  HTMLAttributes: { rel: null, target: null },
  isAllowedUri: (url) => safeHref(url) !== null,
});

/**
 * The one extension list for school rich text: the static renderer and the editor both use it, so
 * everything an editor can write can also be rendered. Headings start at h2: a page's h1 is always
 * its title. No underline: underlined text looks like a link.
 */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    code: false,
    codeBlock: false,
    link: false,
    underline: false,
  }),
  SchoolLink,
  MediaImage,
];
