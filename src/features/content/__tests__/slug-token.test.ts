import { describe, expect, it } from 'vitest';
import { richTextMediaIds } from '@/lib/rich-text/media';
import { DRAFT_TOKEN_TTL_SECONDS, signDraftToken, verifyDraftToken } from '../draft-token';
import { nextSlug, slugify, SLUG_MAX, SLUG_RE } from '../slug';

describe('slugify', () => {
  it.each([
    ["St Mary's Day & Sports — 2026", 'st-marys-day-and-sports-2026'],
    ['Fees and Payments', 'fees-and-payments'],
    ['Équipe de débat', 'equipe-de-debat'],
    ['  Kampala   Campus  ', 'kampala-campus'],
    ['P.7 Results (2026)', 'p-7-results-2026'],
    ['O’Level & A’Level', 'olevel-and-alevel'],
    ['!!!', ''],
  ])('%s → %s', (title, slug) => {
    expect(slugify(title)).toBe(slug);
    if (slug) expect(slug).toMatch(SLUG_RE);
  });

  it('cuts long titles at a word, within the database limit', () => {
    const slug = slugify('a very long title about the school '.repeat(10));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug).toMatch(SLUG_RE);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('numbers a taken address', () => {
    expect(nextSlug('fees')).toBe('fees-2');
    expect(nextSlug('fees-2')).toBe('fees-3');
    expect(nextSlug('a'.repeat(SLUG_MAX)).length).toBeLessThanOrEqual(SLUG_MAX);
  });
});

describe('draft preview token', () => {
  const secret = 'x'.repeat(40);
  const user = '00000000-0000-4000-8000-000000000001';
  const page = '00000000-0000-4000-8000-0000000000aa';
  const now = 1_800_000_000_000;

  it('round-trips for the same user', () => {
    const token = signDraftToken(
      { userId: user, entityType: 'pages', entityId: page },
      secret,
      now,
    );
    const r = verifyDraftToken(token, secret, { userId: user }, now + 1000);
    expect(r).toMatchObject({ ok: true, payload: { i: page, t: 'pages' } });
  });

  it('rejects another user, an expired link, a tampered link and a template-preview token', () => {
    const token = signDraftToken(
      { userId: user, entityType: 'pages', entityId: page },
      secret,
      now,
    );
    expect(
      verifyDraftToken(token, secret, { userId: '00000000-0000-4000-8000-000000000002' }, now),
    ).toEqual({ ok: false, error: 'user' });
    expect(
      verifyDraftToken(token, secret, { userId: user }, now + DRAFT_TOKEN_TTL_SECONDS * 1000),
    ).toEqual({ ok: false, error: 'expired' });
    const [body, mac] = token.split('.');
    expect(verifyDraftToken(`${body}x.${mac}`, secret, { userId: user }, now).ok).toBe(false);
    expect(verifyDraftToken(token, 'y'.repeat(40), { userId: user }, now)).toEqual({
      ok: false,
      error: 'signature',
    });
    expect(verifyDraftToken('not-a-token', secret, { userId: user }, now)).toEqual({
      ok: false,
      error: 'malformed',
    });
  });
});

describe('richTextMediaIds (mirror of private.rich_text_media_ids)', () => {
  it('finds image nodes and PDF links at any depth, once each', () => {
    const img = '22222222-2222-4222-8222-222222222222';
    const pdf = '11111111-1111-4111-8111-111111111111';
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Fees letter',
              marks: [{ type: 'link', attrs: { mediaId: pdf } }],
            },
            { type: 'text', text: 'site', marks: [{ type: 'link', attrs: { href: '/about' } }] },
          ],
        },
        { type: 'image', attrs: { mediaId: img } },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'image', attrs: { mediaId: img } }] }],
        },
        { type: 'image', attrs: { mediaId: 'not-a-uuid' } },
      ],
    };
    expect(richTextMediaIds(doc)).toEqual({ images: [img], documents: [pdf] });
    expect(richTextMediaIds(null)).toEqual({ images: [], documents: [] });
  });
});
