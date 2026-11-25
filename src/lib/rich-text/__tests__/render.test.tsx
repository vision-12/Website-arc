import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { renderRichText } from '../render';
import { isExternalHref, safeHref } from '../safe-href';

const html = (doc: unknown) => renderToStaticMarkup(<>{renderRichText(doc)}</>);
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const link = (href: string) => ({ type: 'link', attrs: { href } });

describe('renderRichText', () => {
  it('drops nodes and marks outside the editor schema instead of failing the page', () => {
    const out = html({
      type: 'doc',
      content: [
        para(text('kept '), text('plain', [{ type: 'highlight' }])),
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
      ],
    });
    expect(out).toContain('kept plain');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('evil');
  });

  it('returns nothing for a document the renderer cannot read', () => {
    expect(
      renderRichText({ type: 'doc', content: [{ type: 'paragraph', content: 'x' }] }),
    ).toBeNull();
  });

  it('renders paragraphs, headings, lists and emphasis as plain semantic HTML', () => {
    const out = html({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Our values')] },
        para(text('We are '), text('proud', [{ type: 'bold' }]), text(' of our pupils.')),
        { type: 'bulletList', content: [{ type: 'listItem', content: [para(text('Kindness'))] }] },
      ],
    });
    expect(out).toContain('<h2>Our values</h2>');
    expect(out).toContain('<strong>proud</strong>');
    expect(out).toMatch(/<ul>\s*<li>\s*<p>Kindness<\/p>\s*<\/li>\s*<\/ul>/);
  });

  it('keeps safe links in the same tab and drops unsafe ones', () => {
    const out = html({
      type: 'doc',
      content: [
        para(text('Visit ', []), text('our page', [link('/about')])),
        para(text('the ministry', [link('https://example.org/education')])),
        para(text('click me', [link('javascript:alert(1)')])),
      ],
    });
    expect(out).toContain('<a href="/about">our page</a>');
    expect(out).toContain(
      '<a href="https://example.org/education" rel="noopener noreferrer nofollow">the ministry</a>',
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click me');
    expect(out).not.toContain('target=');
  });

  it('returns nothing for missing, malformed or oversized documents', () => {
    expect(renderRichText(null)).toBeNull();
    expect(renderRichText({ type: 'paragraph' })).toBeNull();
    expect(renderRichText({ type: 'doc', content: 'nope' })).toBeNull();
    expect(renderRichText({ type: 'doc', content: [para(text('x'.repeat(60_000)))] })).toBeNull();
  });

  it('skips node types the school editor does not support', () => {
    const out = html({
      type: 'doc',
      content: [{ type: 'codeBlock', content: [text('rm -rf /')] }, para(text('still here'))],
    });
    expect(out).not.toContain('rm -rf');
    expect(out).toContain('still here');
  });
});

describe('renderRichText with library media (plan P4-F)', () => {
  const photo = '22222222-2222-4222-8222-222222222222';
  const pdf = '11111111-1111-4111-8111-111111111111';
  const media = {
    images: {
      [photo]: {
        src: 'https://storage.example/media/a.webp',
        width: 1200,
        height: 800,
        alt: 'Pupils reading in the library',
        caption: 'The new library, opened in 2025',
      },
    },
    documents: { [pdf]: { url: 'https://storage.example/media/fees.pdf', sizeBytes: 245_760 } },
  };
  const doc = {
    type: 'doc',
    content: [
      { type: 'image', attrs: { mediaId: photo, size: 'wide' } },
      para(text('Fees letter', [{ type: 'link', attrs: { href: '/old.pdf', mediaId: pdf } }])),
      { type: 'image', attrs: { mediaId: '33333333-3333-4333-8333-333333333333' } },
      para(
        text('Old letter', [
          { type: 'link', attrs: { mediaId: '44444444-4444-4444-8444-444444444444' } },
        ]),
      ),
    ],
  };

  it('draws photos with the library description and caption', () => {
    // Without the library lookup the photo is simply left out.
    expect(html({ type: 'doc', content: [doc.content[0]] })).toBe('');
    const withMedia = renderToStaticMarkup(<>{renderRichText(doc, media)}</>);
    expect(withMedia).toContain('alt="Pupils reading in the library"');
    expect(withMedia).toContain('<figcaption>The new library, opened in 2025</figcaption>');
    expect(withMedia).toContain('rt-figure-wide');
  });

  it('links PDFs to their current file and says what they are', () => {
    const out = renderToStaticMarkup(<>{renderRichText(doc, media)}</>);
    expect(out).toContain('href="https://storage.example/media/fees.pdf"');
    expect(out).toContain('(PDF, 240 KB)');
    expect(out).not.toContain('/old.pdf');
  });

  it('leaves out photos and files that are missing, keeping the link text', () => {
    const out = renderToStaticMarkup(<>{renderRichText(doc, media)}</>);
    expect(out.match(/<img/g)).toHaveLength(1);
    expect(out).toContain('Old letter');
    expect(out).not.toContain('44444444');
  });
});

describe('safeHref', () => {
  it.each([
    ['/admissions', '/admissions'],
    ['#fees', '#fees'],
    ['https://example.org', 'https://example.org'],
    ['mailto:office@example.org', 'mailto:office@example.org'],
    ['tel:+256700000000', 'tel:+256700000000'],
  ])('allows %s', (input, expected) => expect(safeHref(input)).toBe(expected));

  it.each([
    'javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,x',
    '//evil.example',
    '/\\evil',
    'about',
    '',
    42,
  ])('rejects %s', (input) => expect(safeHref(input)).toBeNull());

  it('recognises external links', () => {
    expect(isExternalHref('https://example.org')).toBe(true);
    expect(isExternalHref('/news')).toBe(false);
  });
});
