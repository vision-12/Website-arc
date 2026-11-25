import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { PreviewOverrides, TemplateKey } from './schema';

/**
 * Template preview links (spec §6.4, plan P3-D). A token is an HMAC-signed payload that names the
 * template, the user it was issued to and an expiry ten minutes ahead, plus any unsaved overrides.
 * It is bound to the issuing user, so a copied link is useless to anyone else, and it is never
 * stored. Pure functions: the caller passes the secret (PREVIEW_TOKEN_SECRET) and the clock.
 */

export const PREVIEW_TOKEN_TTL_SECONDS = 600;
/** Larger overrides go through content_drafts in Phase 5, not a URL. */
export const PREVIEW_TOKEN_MAX_LENGTH = 4096;

const Payload = z
  .object({
    v: z.literal(1),
    u: z.uuid(),
    k: TemplateKey,
    e: z.number().int().positive(),
    o: PreviewOverrides.optional(),
  })
  .strict();
export type PreviewPayload = z.infer<typeof Payload>;

export type PreviewTokenError = 'malformed' | 'signature' | 'expired' | 'user' | 'template';

const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(`preview.v1.${body}`).digest('base64url');

export function signPreviewToken(
  input: { userId: string; template: z.infer<typeof TemplateKey>; overrides?: PreviewOverrides },
  secret: string,
  now: number = Date.now(),
): string {
  const payload: PreviewPayload = {
    v: 1,
    u: input.userId,
    k: input.template,
    e: Math.floor(now / 1000) + PREVIEW_TOKEN_TTL_SECONDS,
    ...(input.overrides ? { o: input.overrides } : {}),
  };
  const body = Buffer.from(JSON.stringify(Payload.parse(payload))).toString('base64url');
  const token = `${body}.${sign(body, secret)}`;
  if (token.length > PREVIEW_TOKEN_MAX_LENGTH) throw new Error('PREVIEW_TOO_LARGE');
  return token;
}

export function verifyPreviewToken(
  token: string,
  secret: string,
  expected: { userId: string; template: string },
  now: number = Date.now(),
): { ok: true; payload: PreviewPayload } | { ok: false; error: PreviewTokenError } {
  if (token.length > PREVIEW_TOKEN_MAX_LENGTH) return { ok: false, error: 'malformed' };
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { ok: false, error: 'malformed' };
  const actual = Buffer.from(mac, 'base64url');
  const wanted = Buffer.from(sign(body, secret), 'base64url');
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
    return { ok: false, error: 'signature' };

  let parsed: z.ZodSafeParseResult<PreviewPayload>;
  try {
    parsed = Payload.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (!parsed.success) return { ok: false, error: 'malformed' };
  const payload = parsed.data;
  if (payload.e * 1000 <= now) return { ok: false, error: 'expired' };
  if (payload.u !== expected.userId) return { ok: false, error: 'user' };
  if (payload.k !== expected.template) return { ok: false, error: 'template' };
  return { ok: true, payload };
}
