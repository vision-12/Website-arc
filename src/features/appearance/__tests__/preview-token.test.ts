import { describe, expect, it } from 'vitest';
import {
  PREVIEW_TOKEN_MAX_LENGTH,
  PREVIEW_TOKEN_TTL_SECONDS,
  signPreviewToken,
  verifyPreviewToken,
} from '../preview-token';

const secret = 'a-test-secret-that-is-long-enough-to-sign-links';
const user = '6f1c0a52-3f3b-4d7a-9c55-0b8f0e7f2a11';
const other = '0d4f1e9a-7b2c-4e3d-8f6a-5c4b3a2d1e0f';
const now = Date.UTC(2026, 10, 25, 9, 0, 0);
const expected = { userId: user, template: 'modern-academic' };

describe('template preview tokens (spec §6.4, plan P3-D)', () => {
  const token = signPreviewToken(
    { userId: user, template: 'modern-academic', overrides: { theme: { primary: '#1f3a5f' } } },
    secret,
    now,
  );

  it('round-trips the template, the user and the overrides', () => {
    const r = verifyPreviewToken(token, secret, expected, now + 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({
      k: 'modern-academic',
      u: user,
      o: { theme: { primary: '#1f3a5f' } },
    });
  });

  it('lasts ten minutes', () => {
    const lastSecond = now + PREVIEW_TOKEN_TTL_SECONDS * 1000 - 1;
    expect(verifyPreviewToken(token, secret, expected, lastSecond).ok).toBe(true);
    expect(
      verifyPreviewToken(token, secret, expected, now + PREVIEW_TOKEN_TTL_SECONDS * 1000),
    ).toEqual({
      ok: false,
      error: 'expired',
    });
  });

  it('works only for the user it was issued to, and only for its template', () => {
    expect(verifyPreviewToken(token, secret, { ...expected, userId: other }, now)).toEqual({
      ok: false,
      error: 'user',
    });
    expect(
      verifyPreviewToken(token, secret, { ...expected, template: 'heritage-prestige' }, now),
    ).toEqual({ ok: false, error: 'template' });
  });

  it('rejects a changed payload, a different secret and junk', () => {
    const [body = '', mac = ''] = token.split('.');
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u: string };
    const forged = Buffer.from(JSON.stringify({ ...decoded, u: other })).toString('base64url');
    expect(
      verifyPreviewToken(`${forged}.${mac}`, secret, { ...expected, userId: other }, now),
    ).toEqual({
      ok: false,
      error: 'signature',
    });
    expect(verifyPreviewToken(token, `${secret}-rotated`, expected, now)).toEqual({
      ok: false,
      error: 'signature',
    });
    for (const junk of ['', 'abc', 'a.b.c', `${body}.`, '.x'])
      expect(verifyPreviewToken(junk, secret, expected, now).ok).toBe(false);
  });

  it('refuses overrides too large for a link (Phase 5 stores those as drafts)', () => {
    const homepage = Array.from({ length: 20 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      type: 'customRichText' as const,
      visible: true,
      settings: { heading: 'x'.repeat(200), layout: 'narrow' },
    }));
    expect(() =>
      signPreviewToken(
        { userId: user, template: 'modern-academic', overrides: { homepage } },
        secret,
        now,
      ),
    ).toThrow('PREVIEW_TOO_LARGE');
    expect(
      verifyPreviewToken('x'.repeat(PREVIEW_TOKEN_MAX_LENGTH + 1), secret, expected, now),
    ).toEqual({
      ok: false,
      error: 'malformed',
    });
  });
});
