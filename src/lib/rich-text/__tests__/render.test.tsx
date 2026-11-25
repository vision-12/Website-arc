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
      '<a href="https://example.org/education" rel="noopener noreferrer">the ministry</a>',
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
