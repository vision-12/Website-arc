import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from '@/lib/zod';

/**
 * Draft preview links (MP §5 "Preview", spec §4.8 /api/draft). An HMAC-signed payload naming the
 * user, the item and an expiry ten minutes ahead. The /api/draft route also requires that user's
 * live session, so a copied link is useless to anyone else. Pure functions: the caller passes the
 * secret (PREVIEW_TOKEN_SECRET) and the clock. Distinct prefix from template previews.
 */

export const DRAFT_TOKEN_TTL_SECONDS = 600;
const MAX_LENGTH = 512;

const Payload = z
  .object({
    v: z.literal(1),
    u: z.uuid(),
    t: z.enum(['pages']),
    i: z.uuid(),
    e: z.number().int().positive(),
  })
  .strict();
export type DraftPayload = z.infer<typeof Payload>;
export type DraftEntityType = DraftPayload['t'];
export type DraftTokenError = 'malformed' | 'signature' | 'expired' | 'user';

const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(`draft.v1.${body}`).digest('base64url');

export function signDraftToken(
  input: { userId: string; entityType: DraftEntityType; entityId: string },
  secret: string,
  now: number = Date.now(),
): string {
  const payload: DraftPayload = {
    v: 1,
    u: input.userId,
    t: input.entityType,
    i: input.entityId,
    e: Math.floor(now / 1000) + DRAFT_TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(Payload.parse(payload))).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function verifyDraftToken(
  token: string,
  secret: string,
  expected: { userId: string },
  now: number = Date.now(),
): { ok: true; payload: DraftPayload } | { ok: false; error: DraftTokenError } {
  if (token.length > MAX_LENGTH) return { ok: false, error: 'malformed' };
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { ok: false, error: 'malformed' };
  const actual = Buffer.from(mac, 'base64url');
  const wanted = Buffer.from(sign(body, secret), 'base64url');
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
    return { ok: false, error: 'signature' };

  let parsed: z.ZodSafeParseResult<DraftPayload>;
  try {
    parsed = Payload.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (!parsed.success) return { ok: false, error: 'malformed' };
  if (parsed.data.e * 1000 <= now) return { ok: false, error: 'expired' };
  if (parsed.data.u !== expected.userId) return { ok: false, error: 'user' };
  return { ok: true, payload: parsed.data };
}
