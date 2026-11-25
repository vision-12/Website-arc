import StarterKit from '@tiptap/starter-kit';

/**
 * The one extension list for school rich text. The static renderer uses it now; the Phase 4
 * editor must use the same list so everything an editor can write can also be rendered.
 * Headings start at h2: a page's h1 is always its title.
 */
export const richTextExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    code: false,
    codeBlock: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
];
