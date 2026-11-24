import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { serverEnv } from '@/lib/env/server';

export interface SubmissionTicket {
  issuedAt: string;
  ipHash: string;
  mac: string;
}

/** Canonical message signed by the server and re-computed by private.verify_ticket() in SQL. */
export function ticketMessage(
  purpose: string,
  payload: string,
  issuedAt: string,
  ipHash: string,
): string {
  const payloadHash = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `${purpose}.${payloadHash}.${issuedAt}.${ipHash}`;
}

/**
 * Mints a short-lived, single-use HMAC ticket (spec D5) for a public RPC. Only server code holds
 * FORM_SIGNING_SECRET, so the RPC cannot be called directly with the public key. `payload` must be
 * the exact string sent to the RPC.
 */
export function mintTicket(
  purpose: string,
  payload: string,
  ipHash: string,
  now: number = Date.now(),
): SubmissionTicket {
  const issuedAt = String(now);
  const mac = createHmac('sha256', serverEnv().FORM_SIGNING_SECRET)
    .update(ticketMessage(purpose, payload, issuedAt, ipHash))
    .digest('hex');
  return { issuedAt, ipHash, mac };
}
