import 'server-only';
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { serverEnv } from '@/lib/env/server';

/** Client IP as seen by Vercel's edge (first X-Forwarded-For hop). Never stored raw (spec D10). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || '0.0.0.0';
}

export function hashIp(ip: string): string {
  return createHmac('sha256', serverEnv().IP_HASH_SALT).update(ip).digest('hex').slice(0, 32);
}

/** Lower-cased email, hashed the same way, for rate-limit keys that must not contain the address. */
export function hashEmail(email: string): string {
  return createHmac('sha256', serverEnv().IP_HASH_SALT)
    .update(email.trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

export async function currentIpHash(): Promise<string> {
  return hashIp(await clientIp());
}
